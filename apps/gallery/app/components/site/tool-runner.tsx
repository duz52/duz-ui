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
 * The panel is laid out as four labelled blocks — ELEMENT, TOOL, PARAMETERS,
 * RESULT — adopting the vocabulary of the MCP Inspector's Tools screen
 * (tools list → parameters → results). In one column the panes become blocks
 * in a fixed order, and the order itself teaches the protocol: discover,
 * choose, send, read. Each chip is badged `reads` or `writes` from
 * `AgentTool.annotations?.readOnlyHint`, and the result header reports
 * outcome, elapsed time, and transport. Payloads render through `JsonBlock`,
 * which re-indents the compact wire string and wraps it.
 *
 * `document.modelContext` is never touched here — that belongs to the adapter
 * alone (spec invariant 6), which exposes `executeViaWebMCP` for this.
 */

import * as React from "react"

import { JsonBlock } from "@/components/site/json-block"
import {
  fieldsFor,
  initialArguments,
  type Field,
} from "@/components/site/tool-arguments"
import type {
  CapabilityDescriptor,
  CapabilityState,
} from "@/lib/duz-ui/capability"
import { getCapabilityRegistry } from "@/lib/duz-ui/registry"
import { createAgentTools, type AgentTool } from "@/lib/duz-ui/tools"
import { executeViaWebMCP, isWebMCPSupported } from "@/lib/duz-ui/webmcp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/radix/ui/select"

/** Shared control styling for the runner's text and number inputs. */
const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

/** Segmented-control button pairing the form and JSON views. */
const MODE_BUTTON_CLASS =
  "rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"

/**
 * Label for one of the runner's four fixed blocks. Full `text-muted-foreground`
 * — opacity variants of text this small measured below WCAG AA.
 */
function BlockLabel({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** How a completed run is reported in the result header. */
type Outcome =
  | { kind: "ok" }
  | { kind: "refused"; code: string | null }
  | { kind: "error" }

/**
 * Classify a completed run. A returned payload with `ok === false` is a
 * refusal — a designed outcome of this protocol, not a crash — so it is
 * never an exception; only a thrown dispatch failure is `error`. A payload
 * that does not parse is still a returned result, shown verbatim as `ok`.
 */
function outcomeOf(
  result: string | null,
  error: string | null,
): Outcome | null {
  if (error !== null) return { kind: "error" }
  if (result === null) return null
  try {
    const parsed: unknown = JSON.parse(result)
    if (isRecord(parsed) && parsed.ok === false) {
      const err = parsed.error
      return {
        kind: "refused",
        code: isRecord(err) && typeof err.code === "string" ? err.code : null,
      }
    }
  } catch {
    // Not JSON — report it as a result and let JsonBlock show it verbatim.
  }
  return { kind: "ok" }
}

function outcomeText(outcome: Outcome): string {
  switch (outcome.kind) {
    case "ok":
      return "ok"
    case "refused":
      return outcome.code === null ? "refused" : `refused · ${outcome.code}`
    case "error":
      return "error"
  }
}

function outcomeToneClass(kind: Outcome["kind"]): string {
  switch (kind) {
    case "ok":
      return "text-foreground"
    case "refused":
      // Amber to match JsonBlock's refused border — not red: a refusal is a
      // designed outcome, not a failure.
      return "text-amber-600 dark:text-amber-400"
    case "error":
      return "text-destructive"
  }
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
          <div className="space-y-1.5">
            {nameLabel}
            {/* agent={false}: the runner must not register its own controls as
                agent capabilities, or it would list and operate itself — the
                same reason gallery-layout passes agent={false} to
                SidebarProvider. */}
            <Select
              agent={false}
              value={typeof value === "string" ? value : ""}
              onValueChange={(next) => onChange(field.name, next)}
            >
              {/* The trigger is a button, so the field name is carried by
                  aria-label rather than a wrapping <label>. */}
              <SelectTrigger
                aria-label={field.name}
                className="w-full font-mono text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
  // Read after mount, never during render. `document.modelContext` exists
  // only in the browser, so reading it while rendering makes the server say
  // "not available" and a WebMCP-capable client say "available" — a
  // hydration mismatch. React 19 answers that by discarding the server HTML
  // and re-rendering the whole document, which re-writes <html>'s className
  // and strips the theme class the pre-paint bootstrap had put there: the
  // page flashed dark, then reverted to light, and navigations could land on
  // the error boundary. Deferring the read keeps the first client render
  // identical to the server's.
  const [webmcpAvailable, setWebmcpAvailable] = React.useState(false)
  React.useEffect(() => {
    setWebmcpAvailable(isWebMCPSupported())
  }, [])

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
  const [elapsedMs, setElapsedMs] = React.useState<number | null>(null)
  const [running, setRunning] = React.useState(false)
  const [refusalExplained, setRefusalExplained] = React.useState(false)

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
    // `get`, not `read`: `caps` is a React snapshot and the registry is live,
    // so between a navigation unmounting one page's capabilities and this
    // effect running, the chosen id can already be gone. For a display the
    // honest answer is "no state"; the throwing `read` exists so an *agent*
    // is told why its target is missing, and letting that throw here took
    // the whole route down with it.
    const state =
      nextTarget === null ? null : (registry.get(nextTarget)?.read() ?? null)
    const args = initialArguments(tool, nextTarget, state)
    setFormValues(args)
    setArgState(state)
    setJsonText(JSON.stringify(args, null, 2))
    // The previous result is discarded with the old selection; if it was a
    // refusal, its one-line explanation has been seen.
    if (outcomeOf(result, error)?.kind === "refused") {
      setRefusalExplained(true)
    }
    setResult(null)
    setError(null)
    setElapsedMs(null)
    setJsonError(null)
    // `result` and `error` are read only to mark a discarded refusal as
    // explained; the key guard above keeps the reruns they cause a no-op.
  }, [caps, tools, target, selectedName, registry, preferredTarget, result, error])

  const selectedCap = caps.find((entry) => entry.id === target)
  const selectedTool = tools.find((entry) => entry.name === selectedName) ?? null
  const eligibleTools = actionToolsFor(tools, selectedCap)
  const fields: Field[] =
    selectedTool === null ? [] : fieldsFor(selectedTool, argState)
  const payload = error ?? result
  const outcome = React.useMemo(() => outcomeOf(result, error), [result, error])

  function setFormValue(name: string, value: unknown): void {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  async function runTool(
    tool: AgentTool,
    args: Record<string, unknown>,
  ): Promise<void> {
    // The refusal on screen is being replaced; its one-line explanation has
    // been seen and later refusals do not repeat it.
    if (outcome?.kind === "refused") setRefusalExplained(true)

    setRunning(true)
    setResult(null)
    setError(null)
    setElapsedMs(null)

    const startedAt = performance.now()
    try {
      const output = webmcpAvailable
        ? await executeViaWebMCP(tool.name, args)
        : await tool.execute(args)
      setElapsedMs(performance.now() - startedAt)
      setResult(output)
    } catch (e) {
      setElapsedMs(performance.now() - startedAt)
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
    <div className="space-y-6">
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
        <>
          <section aria-label="Element" className="space-y-2">
            <BlockLabel>Element</BlockLabel>
            <p className="text-xs text-muted-foreground">
              The discovery tools — the two calls an agent makes first: list
              what is mounted on the page, then read the state of one element.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* agent={false}: without it this picker registers a `select`
                  capability and the runner would list and operate itself — the
                  same reason gallery-layout passes agent={false} to
                  SidebarProvider. */}
              <Select
                agent={false}
                value={target ?? ""}
                onValueChange={setTarget}
              >
                <SelectTrigger aria-label="Element" className="max-w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* The id is shown on every option, not only on the chosen
                      one: labels are not unique — a table's row checkboxes all
                      read "Select row" — and the id is what the protocol
                      actually addresses. */}
                  {caps.map((cap) => (
                    <SelectItem key={cap.id} value={cap.id}>
                      <span className="flex items-baseline gap-2">
                        <span>{`${cap.label ?? cap.id} — ${cap.kind}`}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {cap.id}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </section>

          {eligibleTools.length > 0 ? (
            <section aria-label="Tool" className="space-y-2">
              <BlockLabel>Tool</BlockLabel>
              <div className="flex flex-wrap gap-1.5">
                {eligibleTools.map((tool) => (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => setSelectedName(tool.name)}
                    className={
                      "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors " +
                      (tool.name === selectedName
                        ? "border-border bg-muted text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground")
                    }
                  >
                    {tool.name}
                    <span className="rounded-full border border-border px-1.5 py-px text-[10px] leading-none text-muted-foreground">
                      {tool.annotations?.readOnlyHint === true
                        ? "reads"
                        : "writes"}
                    </span>
                  </button>
                ))}
              </div>
              {selectedTool !== null ? (
                <p className="text-sm text-muted-foreground">
                  {selectedTool.description}
                </p>
              ) : null}
            </section>
          ) : null}

          {selectedTool !== null ? (
            <section aria-label="Parameters" className="space-y-3">
              <BlockLabel>Parameters</BlockLabel>
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
            </section>
          ) : null}
        </>
      )}

      {caps.length > 0 || payload !== null ? (
        <section aria-label="Result" className="space-y-2">
          <BlockLabel>Result</BlockLabel>
          {outcome !== null ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              <span className={outcomeToneClass(outcome.kind)}>
                {outcomeText(outcome)}
              </span>
              {elapsedMs !== null ? (
                <span> · {Math.round(elapsedMs)} ms</span>
              ) : null}
              <span> · {webmcpAvailable ? "WebMCP" : "in-page"}</span>
            </p>
          ) : null}
          {outcome?.kind === "refused" && !refusalExplained ? (
            <p className="text-xs text-muted-foreground">
              The tool refused this request by design — the page is unchanged.
              Adjust the arguments and run again.
            </p>
          ) : null}
          {/* The output area reserves its height even before the first result:
              growing it from nothing on the first run moved everything below it
              down in one frame, which reads as the page flashing rather than as
              a result arriving. The placeholder matches JsonBlock's min-h-28,
              and max-h-96 keeps a large ui_list payload scrolling internally
              instead of pushing the page around. */}
          {payload === null ? (
            <div className="flex min-h-28 items-center rounded-lg border border-border bg-muted/40 px-4 text-sm text-muted-foreground">
              Run a tool to see its result.
            </div>
          ) : (
            <JsonBlock
              payload={payload}
              tone={
                outcome?.kind === "refused"
                  ? "refused"
                  : outcome?.kind === "error"
                    ? "error"
                    : "default"
              }
              className="min-h-28 max-h-96"
            />
          )}
        </section>
      ) : null}
    </div>
  )
}
