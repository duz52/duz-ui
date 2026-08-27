/**
 * Agent UI - WebMCP protocol adapter.
 *
 * The only layer that touches `document.modelContext`. It translates the
 * capability registry into WebMCP tools and dispatches agent calls back
 * through the registry, never through the DOM. Tool count scales with
 * capability kinds, not component instances.
 */

import type { CapabilityRegistry } from "./registry"
import { createAgentTools, type AgentTool } from "./tools"

export function isWebMCPSupported(): boolean {
  return getModelContext() != null
}

function getModelContext(): WebMCP.ModelContext | undefined {
  if (typeof document === "undefined") return undefined
  return document.modelContext
}

/**
 * `webmcp-types@0.1.5` does not yet declare `executeTool`, which the WebMCP
 * specification puts on `ModelContext`. Narrowing it here keeps the gap in the
 * one file allowed to know about the protocol.
 *
 * The specification types the second argument as an `object` and serialises it
 * itself, but Chrome's shipping implementation takes the already-serialised
 * JSON string and rejects anything else with "Failed to parse input arguments".
 * This declares what the browser actually accepts.
 * https://developer.chrome.com/docs/ai/webmcp/imperative-api
 */
interface ModelContextWithExecute extends WebMCP.ModelContext {
  executeTool(
    tool: WebMCP.RegisteredTool,
    inputArguments?: string,
  ): Promise<string>
}

/**
 * Runs a registered tool the way an agent would: through the browser's own
 * WebMCP dispatch rather than by calling the tool definition directly.
 *
 * This exists so nothing outside the adapter has to reach for
 * `document.modelContext` (spec invariant 6). It resolves to the tool's string
 * result, and rejects when WebMCP is unavailable or the tool is not registered
 * yet.
 */
export async function executeViaWebMCP(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const modelContext = getModelContext() as ModelContextWithExecute | undefined
  if (!modelContext) {
    throw new Error("WebMCP is not available in this browser.")
  }
  const registered = await modelContext.getTools()
  const tool = registered.find((candidate) => candidate.name === name)
  if (!tool) {
    throw new Error(`The "${name}" tool is not registered with the browser yet.`)
  }
  return modelContext.executeTool(tool, JSON.stringify(input))
}

function toWebMCPTool(tool: AgentTool): WebMCP.ModelContextTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    execute: (inputObject) => tool.execute(inputObject),
  }
}

export function connectWebMCP(registry: CapabilityRegistry): () => void {
  const modelContext = getModelContext()
  if (!modelContext) {
    // Progressive enhancement (spec section 11): without WebMCP the app stays
    // ordinary React UI. Register nothing, tear down nothing.
    return () => {}
  }

  const controllers = new Map<string, AbortController>()
  let disposed = false
  let running = false
  let dirty = false

  /**
   * Brings the registered tool set in line with the registry exactly once.
   * Registration is asynchronous, so `schedule` guarantees runs never
   * interleave rather than reconciling a moving target.
   */
  const reconcile = async () => {
    const desired = createAgentTools(registry)
    const desiredNames = new Set(desired.map((tool) => tool.name))

    for (const [name, controller] of [...controllers]) {
      if (!desiredNames.has(name)) {
        controller.abort()
        controllers.delete(name)
      }
    }

    for (const tool of desired) {
      // A kept registration is always current: its execute closure reads the
      // registry live, so there is nothing to refresh and no churn to cause.
      if (controllers.has(tool.name)) continue

      const controller = new AbortController()
      try {
        await modelContext.registerTool(toWebMCPTool(tool), {
          signal: controller.signal,
        })
      } catch (error) {
        // Progressive enhancement again: a failed registration must never
        // break human interaction. This is the one place a catch is correct.
        console.warn(
          "[agent-ui]",
          `Failed to register the WebMCP tool "${tool.name}":`,
          error,
        )
        continue
      }

      if (disposed) {
        controller.abort()
        continue
      }
      controllers.set(tool.name, controller)
    }
  }

  const schedule = () => {
    if (running) {
      dirty = true
      return
    }
    running = true
    void (async () => {
      do {
        dirty = false
        await reconcile()
      } while (dirty && !disposed)
      running = false
    })()
  }

  const unsubscribe = registry.subscribe(schedule)
  schedule()

  return () => {
    disposed = true
    unsubscribe()
    for (const controller of controllers.values()) {
      controller.abort()
    }
    controllers.clear()
  }
}

