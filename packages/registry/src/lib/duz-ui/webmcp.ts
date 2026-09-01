/**
 * Duz UI - WebMCP protocol adapter.
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
 * Both argument forms are declared because both are real. The specification
 * takes an object and serialises it itself:
 *
 *     Promise<DOMString> executeTool(RegisteredTool tool,
 *                                    optional object inputObject = {}, ...)
 *
 * Chrome 151 takes the already-serialised JSON string instead, rejects an
 * object with "Failed to parse input arguments", and requires the argument the
 * specification makes optional. Declaring only one of the two, as this did,
 * states a browser's dialect as the protocol.
 * https://github.com/webmachinelearning/webmcp/blob/main/index.bs
 * https://developer.chrome.com/docs/ai/webmcp/imperative-api
 */
interface ModelContextWithExecute extends WebMCP.ModelContext {
  executeTool(
    tool: WebMCP.RegisteredTool,
    inputArguments?: object | string,
  ): Promise<string>
}

/**
 * Which argument form this browser's `executeTool` accepts, learned once and
 * reused for the rest of the page's life.
 *
 * No single value satisfies both shipping implementations: Chrome rejects the
 * object, and an implementation that follows the specification rejects the
 * string. So the form cannot be assumed, and it is not guessed from a user
 * agent either — it is learned from what the browser does with a call.
 *
 * The specification's form is sent first, so the standard is the default and
 * Chrome's dialect is the exception that gets discovered; when Chrome
 * conforms, this stops firing on its own with nothing to remove.
 *
 * Retrying is safe here, which is not a general licence. A tool of ours does
 * not throw to report a refusal — it answers with `{ ok: false }` as data, the
 * whole point of the refusal design — so an exception out of `executeTool` is
 * the browser rejecting the call, not a tool that ran and failed. And a
 * rejection on the way in means nothing ran: an implementation that cannot
 * read its input has not reached the tool.
 */
let wireFormat: "object" | "string" | undefined

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
  if (wireFormat === "string") {
    return modelContext.executeTool(tool, JSON.stringify(input))
  }

  try {
    const result = await modelContext.executeTool(tool, input)
    wireFormat = "object"
    return result
  } catch (error) {
    // Already known to take objects: this is the tool's own failure, not a
    // dialect to work around.
    if (wireFormat === "object") throw error
    const result = await modelContext.executeTool(tool, JSON.stringify(input))
    wireFormat = "string"
    return result
  }
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
          "[duz-ui]",
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

