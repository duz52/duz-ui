"use client"

/**
 * Shared WebMCP tool runner.
 *
 * Lists the agent tools derived from the live capability registry, lets the
 * user edit arguments as JSON and run a tool. Both execution paths reach the
 * same `AgentTool.execute` closure, and therefore the same registry: with
 * WebMCP the browser dispatches to the tool it registered, without it the
 * closure is called directly. One definition, two transports.
 *
 * `document.modelContext` is never touched here — that belongs to the adapter
 * alone (spec invariant 6), which exposes `executeViaWebMCP` for this.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { getCapabilityRegistry } from "@/lib/agent-ui/registry"
import { createAgentTools, type AgentTool } from "@/lib/agent-ui/tools"
import { executeViaWebMCP, isWebMCPSupported } from "@/lib/agent-ui/webmcp"

function defaultValueFor(def: unknown): unknown {
  if (typeof def !== "object" || def === null) return null
  const d = def as Record<string, unknown>
  if (d.default !== undefined) return d.default
  switch (d.type) {
    case "string":
      return ""
    case "boolean":
      return false
    case "integer":
    case "number":
      return 0
    case "array":
      return []
    default:
      return null
  }
}

/** Pre-fills the arguments textarea from a tool's JSON Schema. */
function schemaDefaults(schema: AgentTool["inputSchema"]): string {
  const sample: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(schema.properties)) {
    sample[key] = defaultValueFor(def)
  }
  return JSON.stringify(sample, null, 2)
}

export function ToolRunner(): React.JSX.Element {
  const registry = getCapabilityRegistry()
  const webmcpAvailable = isWebMCPSupported()

  const [tools, setTools] = React.useState<AgentTool[]>([])
  const [selectedName, setSelectedName] = React.useState<string | undefined>()
  const [argsText, setArgsText] = React.useState("")
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [usedPath, setUsedPath] = React.useState<"webmcp" | "in-page" | null>(
    null,
  )

  // Tools scale with mounted capability kinds, so refresh on every registry
  // notification (mount/unmount of any agent-operable component).
  React.useEffect(() => {
    const refresh = () => setTools(createAgentTools(registry))
    refresh()
    return registry.subscribe(refresh)
  }, [registry])

  const selectedTool = tools.find((t) => t.name === selectedName)

  function selectTool(name: string): void {
    const tool = tools.find((t) => t.name === name)
    setSelectedName(name)
    setArgsText(tool ? schemaDefaults(tool.inputSchema) : "")
    setResult(null)
    setError(null)
    setUsedPath(null)
  }

  // Auto-select the first tool when none is chosen yet.
  React.useEffect(() => {
    if (selectedName !== undefined || tools.length === 0) return
    const first = tools[0]
    if (!first) return
    setSelectedName(first.name)
    setArgsText(schemaDefaults(first.inputSchema))
  }, [selectedName, tools])

  async function handleRun(): Promise<void> {
    const tool = selectedTool
    if (!tool) return

    let args: Record<string, unknown>
    try {
      args = argsText.trim() === "" ? {} : JSON.parse(argsText)
    } catch {
      setError("Arguments are not valid JSON.")
      return
    }

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

      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agent-operable elements are mounted on this page.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <button
                key={tool.name}
                type="button"
                onClick={() => selectTool(tool.name)}
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

          {selectedTool ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {selectedTool.description}
              </p>
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] text-muted-foreground">
                  arguments (JSON)
                </p>
                <textarea
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>
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
            <span className="ml-2 text-muted-foreground/70">
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
