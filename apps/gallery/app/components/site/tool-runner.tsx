"use client"

/**
 * Shared WebMCP tool runner.
 *
 * Renders the agent tools derived from the live capability registry as a real
 * form: an element picker fills `target`, action chips offer the tools that
 * apply to the selected element, and per-field controls replace hand-edited
 * JSON (a JSON mode stays available as the escape hatch). Both execution
 * paths reach the same `AgentTool.execute` closure, and therefore the same
 * registry: with WebMCP the browser dispatches to the tool it registered,
 * without it the closure is called directly. One definition, two transports.
 *
 * `document.modelContext` is never touched here — that belongs to the adapter
 * alone (spec invariant 6), which exposes `executeViaWebMCP` for this.
 */

import * as React from "react"

import {
  fieldsFor,
  initialArguments,
  type Field,
} from "@/components/site/tool-arguments"
import type {
  CapabilityDescriptor,
  CapabilityState,
} from "@/lib/agent-ui/capability"
import { getCapabilityRegistry } from "@/lib/agent-ui/registry"
import { createAgentTools, type AgentTool } from "@/lib/agent-ui/tools"
import { executeViaWebMCP, isWebMCPSupported } from "@/lib/agent-ui/webmcp"
import { cn } from "@/lib/utils"

/** Shared control styling for the runner's text inputs and selects. */
const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

/** Segmented-control button pairing the form and JSON views. */
const MODE_BUTTON_CLASS =
  "rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Whether `tool` can act on the element described by `cap`. */
function isEligible(tool: AgentTool, cap: CapabilityDescriptor): boolean {
  switch (tool.scope.on) {
    case "page":
      return false
    case "any-capability":
      return true
    case "kind":
      return (
        cap.kind === tool.scope.kind &&
        cap.actions.includes(tool.scope.action)
      )
    case "capability":
      return cap.id === tool.scope.id
  }
}

/**
 * Tools that act on the element `cap` itself. The discovery tools are rendered
 * as the picker's buttons, never as chips.
 */
function actionToolsFor(
  tools: AgentTool[],
  cap: CapabilityDescriptor | undefined,
): AgentTool[] {
  if (cap === undefined) return []
  return tools.filter(
    (tool) =>
      tool.name !== "ui_list" &&
      tool.name !== "ui_read" &&
      isEligible(tool, cap),
  )
}

/**
 * The argument object the form sends: the picker's target (when the tool takes
 * one) plus the user's values, with cleared optional numbers omitted the way
 * JSON.stringify would omit them.
 */
function argsFromForm(
  tool: AgentTool,
  target: string | null,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) rest[key] = value
  }
  return "target" in tool.inputSchema.properties ? { target, ...rest } : rest
}

/**
 * Adopt a parsed JSON object into form values: known fields are coerced to
 * their control's value type (an uncoercible value becomes "cleared"), and
 * unknown keys are preserved so nothing the user typed is lost. `target` is
 * not adopted — in form mode the element picker is its single source of truth.
 */
function adoptJson(
  fields: Field[],
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== "target") values[key] = value
  }
  for (const field of fields) {
    const raw = parsed[field.name]
    if (raw === undefined) continue
    switch (field.type) {
      case "text":
        values[field.name] =
          typeof raw === "string" ? raw : raw === null ? "" : String(raw)
        break
      case "number":
        values[field.name] =
          typeof raw === "number" && Number.isFinite(raw) ? raw : undefined
        break
      case "boolean":
        values[field.name] = typeof raw === "boolean" ? raw : undefined
        break
      case "choice":
        values[field.name] = raw === null ? "" : String(raw)
        break
      case "multi-choice":
        values[field.name] = Array.isArray(raw)
          ? raw.filter((entry): entry is string => typeof entry === "string")
          : []
        break
      case "string-list":
        values[field.name] = Array.isArray(raw)
          ? raw.map((entry) =>
              typeof entry === "string" ? entry : String(entry),
            )
          : []
        break
      case "number-list": {
        const entries = Array.isArray(raw) ? raw : []
        const list: (number | null)[] = []
        for (let i = 0; i < field.length; i++) {
          const entry = entries[i]
          list.push(
            typeof entry === "number" && Number.isFinite(entry) ? entry : null,
          )
        }
        values[field.name] = list
        break
      }
    }
  }
  return values
}

/** One labelled control for one `Field`, reading and writing `formValues`. */
function ArgumentField({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (name: string, value: unknown) => void
}): React.JSX.Element {
  const nameLabel = (
    <span className="font-mono text-[11px] text-muted-foreground">
      {field.name}
    </span>
  )
  const help =
    field.description === undefined ? null : (
      <p className="text-xs text-muted-foreground">{field.description}</p>
    )

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            {nameLabel}
            <input
              type="text"
              spellCheck={false}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={CONTROL_CLASS}
            />
          </label>
          {help}
        </div>
      )
    case "number": {
      const current = typeof value === "number" ? value : undefined
      return (
        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            {nameLabel}
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={current === undefined ? "" : String(current)}
              onChange={(e) => {
                const raw = e.target.value
                onChange(field.name, raw === "" ? undefined : Number(raw))
              }}
              className={CONTROL_CLASS}
            />
          </label>
          {help}
        </div>
      )
    }
    case "boolean":
      return (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value === true}
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
            {nameLabel}
          </label>
          {help}
        </div>
      )
    case "choice":
      return (
        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            {nameLabel}
            <select
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={CONTROL_CLASS}
            >
              {field.options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {help}
        </div>
      )
    case "multi-choice": {
      const selected = Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : []
      return (
        <div className="space-y-1.5">
          {nameLabel}
          <div className="space-y-1">
            {field.options.map((option) => {
              const checked = selected.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    disabled={option.disabled}
                    onChange={() =>
                      onChange(
                        field.name,
                        checked
                          ? selected.filter((entry) => entry !== option.value)
                          : [...selected, option.value],
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
          {help}
        </div>
      )
    }
    case "string-list": {
      const entries = Array.isArray(value)
        ? value.map((entry) =>
            typeof entry === "string" ? entry : String(entry),
          )
        : []
      return (
        <div className="space-y-1.5">
          {nameLabel}
          <div className="space-y-1.5">
            {entries.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  type="text"
                  spellCheck={false}
                  value={entry}
                  onChange={(e) =>
                    onChange(
                      field.name,
                      entries.map((existing, i) =>
                        i === index ? e.target.value : existing,
                      ),
                    )
                  }
                  className={CONTROL_CLASS}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      field.name,
                      entries.filter((_, i) => i !== index),
                    )
                  }
                  className="rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(field.name, [...entries, ""])}
              className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              add entry
            </button>
          </div>
          {help}
        </div>
      )
    }
    case "number-list": {
      const raw = Array.isArray(value) ? value : []
      const entries: (number | null)[] = []
      for (let i = 0; i < field.length; i++) {
        const entry = raw[i]
        entries.push(
          typeof entry === "number" && Number.isFinite(entry) ? entry : null,
        )
      }
      return (
        <div className="space-y-1.5">
          {nameLabel}
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry, index) => (
              <input
                key={index}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={entry === null ? "" : String(entry)}
                onChange={(e) => {
                  const next = [...entries]
                  next[index] =
                    e.target.value === "" ? null : Number(e.target.value)
                  onChange(field.name, next)
                }}
                className="h-9 w-24 rounded-md border border-input bg-transparent px-3 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              />
            ))}
          </div>
          {help}
        </div>
      )
    }
  }
}

/**
 * Picks the element the runner opens on. A page that knows which of its
 * capabilities the visitor came to see says so; otherwise the first live one
 * is as good a guess as any. Without this, a page whose preview mounts
 * several capabilities — a data table also mounts a checkbox per row — opens
 * on whichever happens to be first in the registry, which is not the one the
 * page is about.
 */
function chooseTarget(
  caps: CapabilityDescriptor[],
  preferred: string | undefined,
  current: string | null,
): string | null {
  if (current !== null && caps.some((cap) => cap.id === current)) return current
  if (preferred !== undefined && caps.some((cap) => cap.id === preferred)) {
    return preferred
  }
  return caps[0]?.id ?? null
}

export function ToolRunner({
  preferredTarget,
}: {
  /** Id of the capability to select first, when it is mounted. */
  preferredTarget?: string
} = {}): React.JSX.Element {
  const registry = getCapabilityRegistry()
  const webmcpAvailable = isWebMCPSupported()

  const [caps, setCaps] = React.useState<CapabilityDescriptor[]>(() =>
    registry.describeAll(),
  )
  const [tools, setTools] = React.useState<AgentTool[]>(() =>
    createAgentTools(registry),
  )
  const [target, setTarget] = React.useState<string | null>(() =>
    chooseTarget(registry.describeAll(), preferredTarget, null),
  )
  const [selectedName, setSelectedName] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"form" | "json">("form")
  const [formValues, setFormValues] = React.useState<
    Record<string, unknown>
  >({})
  const [argState, setArgState] = React.useState<CapabilityState | null>(null)
  const [jsonText, setJsonText] = React.useState("")
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [usedPath, setUsedPath] = React.useState<"webmcp" | "in-page" | null>(
    null,
  )

  // Tools scale with mounted capability kinds, so refresh on every registry
  // notification (mount/unmount of any agent-operable component).
  //
  // The first refresh is not optional. Capabilities register in effects, so at
  // the render that seeded this state none of them existed yet; a subscription
  // alone would then wait for a *change* that never comes on a page whose
  // capabilities all mount at once and never re-register. That is why the
  // picker came up empty on the playground while the demo happened to work —
  // the demo's row checkboxes resolve their accessible name after mount and
  // re-register, delivering a notification by luck.
  React.useEffect(() => {
    const refresh = () => {
      setCaps(registry.describeAll())
      setTools(createAgentTools(registry))
    }
    refresh()
    return registry.subscribe(refresh)
  }, [registry])

  // Keep the element and tool selections coherent with the live registry, and
  // recompute the arguments whenever the selected tool or target changes —
  // in between, the user's edits win.
  const lastArgsKey = React.useRef<string | null>(null)
  React.useEffect(() => {
    const nextTarget = chooseTarget(caps, preferredTarget, target)
    const cap = caps.find((entry) => entry.id === nextTarget)
    const eligible = actionToolsFor(tools, cap)
    const nextName =
      selectedName !== null &&
      eligible.some((tool) => tool.name === selectedName)
        ? selectedName
        : (eligible[0]?.name ?? null)

    if (nextTarget !== target) setTarget(nextTarget)
    if (nextName !== selectedName) setSelectedName(nextName)

    const key = nextName === null ? null : `${nextName}\n${nextTarget ?? ""}`
    if (key === lastArgsKey.current) return
    lastArgsKey.current = key

    const tool = tools.find((entry) => entry.name === nextName)
    if (tool === undefined) return
    const state = nextTarget === null ? null : registry.read(nextTarget)
    const args = initialArguments(tool, nextTarget, state)
    setFormValues(args)
    setArgState(state)
    setJsonText(JSON.stringify(args, null, 2))
    setResult(null)
    setError(null)
    setUsedPath(null)
    setJsonError(null)
  }, [caps, tools, target, selectedName, registry, preferredTarget])

  const selectedCap = caps.find((entry) => entry.id === target)
  const selectedTool = tools.find((entry) => entry.name === selectedName) ?? null
  const eligibleTools = actionToolsFor(tools, selectedCap)
  const fields: Field[] =
    selectedTool === null ? [] : fieldsFor(selectedTool, argState)

  function setFormValue(name: string, value: unknown): void {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  async function runTool(
    tool: AgentTool,
    args: Record<string, unknown>,
  ): Promise<void> {
    setRunning(true)
    setResult(null)
    setError(null)
    setUsedPath(null)

    try {
      if (webmcpAvailable) {
        setResult(await executeViaWebMCP(tool.name, args))
        setUsedPath("webmcp")
      } else {
        setResult(await tool.execute(args))
        setUsedPath("in-page")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  function runDiscovery(
    name: "ui_list" | "ui_read",
    args: Record<string, unknown>,
  ): void {
    const tool = tools.find((entry) => entry.name === name)
    if (tool !== undefined) void runTool(tool, args)
  }

  async function handleRun(): Promise<void> {
    if (selectedTool === null) return

    let args: Record<string, unknown>
    if (mode === "json") {
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        setJsonError("Arguments are not valid JSON.")
        return
      }
      if (!isRecord(parsed)) {
        setJsonError("Arguments must be a JSON object.")
        return
      }
      setJsonError(null)
      args = parsed
    } else {
      args = argsFromForm(selectedTool, target, formValues)
    }

    await runTool(selectedTool, args)
  }

  function showJson(): void {
    if (selectedTool === null) return
    setJsonText(
      JSON.stringify(argsFromForm(selectedTool, target, formValues), null, 2),
    )
    setJsonError(null)
    setMode("json")
  }

  function showForm(): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setJsonError("Arguments are not valid JSON.")
      return
    }
    if (!isRecord(parsed)) {
      setJsonError("Arguments must be a JSON object.")
      return
    }
    setFormValues(adoptJson(fields, parsed))
    setJsonError(null)
    setMode("form")
  }

  const discoveryButtonClass =
    "inline-flex h-9 items-center rounded-md border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"

  const listElementsButton = (
    <button
      type="button"
      onClick={() => runDiscovery("ui_list", {})}
      disabled={running}
      className={discoveryButtonClass}
    >
      List elements
    </button>
  )

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] text-muted-foreground">
        {webmcpAvailable ? (
          "WebMCP available"
        ) : (
          <>
            WebMCP not available in this browser — running tools in-page.{" "}
            <span className="text-foreground/70">
              chrome://flags/#enable-webmcp-testing
            </span>
          </>
        )}
      </p>

      {caps.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No agent-operable elements are mounted on this page.
          </p>
          {listElementsButton}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                element
              </span>
              <select
                value={target ?? ""}
                onChange={(e) => setTarget(e.target.value)}
                className="h-9 max-w-72 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {caps.map((cap) => (
                  <option key={cap.id} value={cap.id}>
                    {`${cap.label ?? cap.id} — ${cap.kind}`}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {target}
            </span>
            <div className="ml-auto flex gap-1.5">
              {listElementsButton}
              <button
                type="button"
                onClick={() => runDiscovery("ui_read", { target })}
                disabled={running}
                className={discoveryButtonClass}
              >
                Read state
              </button>
            </div>
          </div>

          {eligibleTools.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {eligibleTools.map((tool) => (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => setSelectedName(tool.name)}
                    className={
                      "rounded border px-2 py-1 font-mono text-[11px] transition-colors " +
                      (tool.name === selectedName
                        ? "border-border bg-muted text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground")
                    }
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
              {selectedTool !== null ? (
                <p className="text-sm text-muted-foreground">
                  {selectedTool.description}
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedTool !== null ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-active={mode === "form"}
                  onClick={showForm}
                  className={MODE_BUTTON_CLASS}
                >
                  Form
                </button>
                <button
                  type="button"
                  data-active={mode === "json"}
                  onClick={showJson}
                  className={MODE_BUTTON_CLASS}
                >
                  JSON
                </button>
              </div>

              {mode === "form" ? (
                fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No arguments.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <ArgumentField
                        key={field.name}
                        field={field}
                        value={formValues[field.name]}
                        onChange={setFormValue}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value)
                      setJsonError(null)
                    }}
                    rows={8}
                    spellCheck={false}
                    className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  {jsonError !== null ? (
                    <p className="text-xs text-destructive">{jsonError}</p>
                  ) : null}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={running}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {running ? "Running…" : "Run tool"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* The output area is always present and reserves its height. Growing it
          from nothing on the first run moved everything below it down in one
          frame, which reads as the page flashing rather than as a result
          arriving. */}
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] text-muted-foreground">
          {error !== null ? "error" : "result"}
          {usedPath !== null ? (
            // Full muted-foreground, not an opacity variant: at /70 this
            // 11px hint measured 2.71:1 in light and 4.20:1 in dark, below
            // the WCAG AA 4.5:1 required at this size.
            <span className="ml-2 text-muted-foreground">
              via {usedPath === "webmcp" ? "WebMCP" : "in-page execution"}
            </span>
          ) : null}
        </p>
        <pre
          className={cn(
            "min-h-28 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed",
            error !== null && "text-destructive",
          )}
        >
          <code>
            {error ??
              result ?? (
                <span className="text-muted-foreground">
                  Run a tool to see its result.
                </span>
              )}
          </code>
        </pre>
      </div>
    </div>
  )
}
