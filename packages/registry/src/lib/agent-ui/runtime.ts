/**
 * Agent UI - composition root.
 *
 * This is the only place the capability registry and the WebMCP protocol
 * adapter meet. The kernel (`registry.ts`) does not know WebMCP exists; the
 * binding (`use-capability.ts`) does not know WebMCP exists. Exactly one
 * file wires them together.
 *
 *         runtime.ts          composition root
 *         /        \
 *   registry.ts   webmcp.ts
 *     kernel        adapter
 */

import { connectWebMCP } from "./webmcp"
import { getCapabilityRegistry, type CapabilityRegistry } from "./registry"

export interface AgentUIRuntime {
  registry: CapabilityRegistry
}

const RUNTIME_KEY = Symbol.for("agent-ui.runtime")

type RuntimeHost = { [RUNTIME_KEY]?: AgentUIRuntime }

/**
 * The single live runtime for this document. On first creation it takes the
 * canonical registry and connects the WebMCP adapter; every later call
 * returns the same object and connects nothing. The connection lives as
 * long as the document, so the disposer `connectWebMCP` returns is not
 * stored — nothing can call it. Tests that need a disposable connection
 * call `connectWebMCP` directly.
 *
 * Keyed off a global symbol so module duplication (HMR, multiple bundles)
 * still resolves to one canonical runtime.
 */
export function getAgentUIRuntime(): AgentUIRuntime {
  const host = globalThis as RuntimeHost
  const existing = host[RUNTIME_KEY]
  if (existing) return existing
  const registry = getCapabilityRegistry()
  connectWebMCP(registry)
  const runtime: AgentUIRuntime = { registry }
  host[RUNTIME_KEY] = runtime
  return runtime
}
