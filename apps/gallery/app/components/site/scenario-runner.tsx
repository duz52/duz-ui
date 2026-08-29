"use client"

/**
 * Scenario runner for the demo page.
 *
 * Executes a recorded sequence of agent tool calls against the live capability
 * registry and shows the exact request and response of every step. This is not
 * a live model: it is precisely the call sequence an agent would make, run
 * through the same two dispatch paths the shared tool runner uses — the
 * browser's WebMCP registration when available, the tool definition directly
 * otherwise. Both reach the same `AgentTool.execute` and therefore the same
 * registry. Like every consumer, this file never touches
 * `document.modelContext`; only the `webmcp.ts` adapter may.
 */

import * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { CopyButton } from "@/components/site/copy-button"
import type { CapabilityState } from "@/lib/agent-ui/capability"
import {
  getCapabilityRegistry,
  type CapabilityRegistry,
} from "@/lib/agent-ui/registry"
import { createAgentTools } from "@/lib/agent-ui/tools"
import { executeViaWebMCP, isWebMCPSupported } from "@/lib/agent-ui/webmcp"
import { cn } from "@/lib/utils"

/** Arguments of one step: static JSON, or derived from live capability state. */
export type StepArgs =
  | Record<string, unknown>
  | ((read: (id: string) => CapabilityState) => Record<string, unknown>)

export interface Step {
  tool: string
  args: StepArgs
  /** One short line saying what this step accomplishes. */
  note: string
}

export interface Scenario {
  id: string
  title: string
  /** The natural-language instruction a user would give an agent. */
  prompt: string
  steps: Step[]
}

type StepStatus = "pending" | "running" | "done" | "refused" | "error"

interface StepRecord {
  status: StepStatus
  request: string | null
  response: string | null
  elapsedMs: number | null
}

/**
 * Pause between steps so a human can watch the UI move. Purely presentational
 * pacing — correctness never depends on it.
 */
const STEP_PAUSE_MS = 600

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * A refusal travels in the returned result as `{"ok": false, ...}`, never as a
 * thrown error.
 */
function isRefusal(response: string): boolean {
  const parsed: unknown = JSON.parse(response)
  return isRecord(parsed) && parsed.ok === false
}

/**
 * One dispatch, one transport choice. The tool list is never captured across
 * steps: opening a dialog mounts new capability kinds, so the set of tools is
 * resolved fresh on every call — from the browser's live WebMCP registration
 * when available, otherwise re-derived from the registry.
 */
async function dispatchTool(
  registry: CapabilityRegistry,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (isWebMCPSupported()) {
    return executeViaWebMCP(name, args)
  }
  const tool = createAgentTools(registry).find(
    (candidate) => candidate.name === name,
  )
  if (!tool) {
    throw new Error(
      `The "${name}" tool is not available. Its target may not be mounted yet.`,
    )
  }
  return tool.execute(args)
}

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-foreground",
  done: "text-emerald-600 dark:text-emerald-400",
  refused: "text-destructive",
  error: "text-destructive",
}

// Same surface as the tool runner's output area: bordered, muted, monospaced,
// horizontally scrolling. Not a third style.
const TRANSCRIPT_PRE =
  "overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed"

export function ScenarioRunner({
  scenarios,
}: {
  scenarios: Scenario[]
}): React.JSX.Element {
  const registry = getCapabilityRegistry()
  const [active, setActive] = React.useState<{
    scenario: Scenario
    steps: StepRecord[]
  } | null>(null)
  const [runningId, setRunningId] = React.useState<string | null>(null)

  // Token of the armed run. Incrementing it retires the running loop at the
  // next step boundary; a retired loop never touches state again.
  const runTokenRef = React.useRef(0)

  // Retire any run still in flight when this component goes away.
  React.useEffect(() => {
    return () => {
      runTokenRef.current++
    }
  }, [])

  function patchStep(index: number, changes: Partial<StepRecord>): void {
    setActive((prev) => {
      if (!prev) return prev
      const steps = prev.steps.slice()
      steps[index] = { ...steps[index]!, ...changes }
      return { scenario: prev.scenario, steps }
    })
  }

  async function run(scenario: Scenario): Promise<void> {
    const token = ++runTokenRef.current
    setActive({
      scenario,
      steps: scenario.steps.map(() => ({
        status: "pending",
        request: null,
        response: null,
        elapsedMs: null,
      })),
    })
    setRunningId(scenario.id)

    const read = (id: string): CapabilityState => registry.read(id)
    const alive = () => runTokenRef.current === token

    for (let index = 0; index < scenario.steps.length; index++) {
      if (!alive()) return
      const step = scenario.steps[index]!

      const startedAt = performance.now()
      try {
        // Arguments may be derived from live state — what an agent does when
        // it calls ui_read before acting. A derivation failure is a step
        // failure like any other.
        const args =
          typeof step.args === "function" ? step.args(read) : step.args
        patchStep(index, { status: "running", request: JSON.stringify(args) })

        const response = await dispatchTool(registry, step.tool, args)
        if (!alive()) return
        const elapsedMs = Math.round(performance.now() - startedAt)

        if (isRefusal(response)) {
          // A refusal ends the scenario; it is a result, not a crash.
          patchStep(index, { status: "refused", response, elapsedMs })
          break
        }
        patchStep(index, { status: "done", response, elapsedMs })
      } catch (error) {
        // A genuine dispatch failure (e.g. the browser has not registered a
        // freshly mounted tool yet) — recorded, and the scenario stops.
        if (!alive()) return
        patchStep(index, {
          status: "error",
          response: error instanceof Error ? error.message : String(error),
          elapsedMs: Math.round(performance.now() - startedAt),
        })
        break
      }

      if (index < scenario.steps.length - 1) {
        await pause(STEP_PAUSE_MS)
      }
    }

    if (alive()) {
      setRunningId(null)
    }
  }

  function stop(): void {
    runTokenRef.current++
    setRunningId(null)
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] text-muted-foreground">
          scenario runner
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A recorded sequence of tool calls — not a live model. These are
          exactly the calls an agent makes, dispatched against the same
          capability registry the tool runner uses. Copy a prompt into your own
          agent and it should produce the same sequence.
        </p>
      </div>

      <ol className="space-y-3">
        {scenarios.map((scenario) => (
          <li
            key={scenario.id}
            className="space-y-2 rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{scenario.title}</h3>
              {runningId === scenario.id ? (
                <Button variant="outline" size="sm" onClick={stop}>
                  Stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={runningId !== null}
                  onClick={() => void run(scenario)}
                >
                  Run
                </Button>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {scenario.prompt}
              </p>
              <CopyButton value={scenario.prompt} />
            </div>
          </li>
        ))}
      </ol>

      {/* The transcript is armed with every step in the pending state the
          moment a run starts, and each step reserves the height of its request
          and response blocks. Growing the transcript from nothing as results
          arrive moves the page under the reader's eye — the same failure the
          tool runner's reserved output area fixes. */}
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] text-muted-foreground">
          transcript
        </p>
        {active === null ? (
          <pre className={cn(TRANSCRIPT_PRE, "min-h-28")}>
            <code>
              <span className="text-muted-foreground">
                Run a scenario to see every tool call it makes.
              </span>
            </code>
          </pre>
        ) : (
          <ol className="space-y-3">
            {active.scenario.steps.map((step, index) => {
              const record = active.steps[index]!
              return (
                <li
                  key={index}
                  className="space-y-2 rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Step {index + 1}
                    </span>
                    <code className="font-mono text-[13px]">{step.tool}</code>
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        STATUS_COLOR[record.status],
                      )}
                    >
                      {record.status}
                    </span>
                    {record.elapsedMs !== null ? (
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                        {record.elapsedMs} ms
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.note}</p>
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      request
                    </p>
                    <pre className={cn(TRANSCRIPT_PRE, "min-h-14")}>
                      <code>{record.request ?? ""}</code>
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      response
                    </p>
                    <pre
                      className={cn(
                        TRANSCRIPT_PRE,
                        "min-h-14",
                        record.status === "error" && "text-destructive",
                      )}
                    >
                      <code>{record.response ?? ""}</code>
                    </pre>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
