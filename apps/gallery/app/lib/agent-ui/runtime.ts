/**
 * Agent UI - composition root.
 *
 * This is the only place the capability registry and the WebMCP protocol
 * adapter meet. The kernel (`registry.ts`) does not know WebMCP exists; the
 * binding (`use-capability.ts`) does not know WebMCP exists. Exactly one
 * file wires them together.
 *
 * Composition happens here, but activation is deliberately separate from
 * lookup. `getAgentUIRuntime()` is a pure-ish lookup: it creates the runtime
 * object and stores it on a global symbol, and it connects nothing. Creating
 * a plain object and reading `getCapabilityRegistry()` is idempotent and
 * observationally pure, which render can tolerate. Connecting the WebMCP
 * adapter is a side effect on the browser, so it belongs to a capability
 * committing, not to React deciding to render. A discarded render connects
 * nothing, and an explicit opt-out (`agent={false}`) connects nothing.
 * `activate()` is called from the registration `useEffect` in
 * `use-capability.ts`, the first time a capability mounts.
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
  /** Connects the WebMCP adapter the first time a capability commits. Idempotent. */
  activate(): void
}

const RUNTIME_KEY = Symbol.for("agent-ui.runtime")

type RuntimeHost = { [RUNTIME_KEY]?: AgentUIRuntime }

/**
 * The single live runtime for this document. On first creation it takes the
 * canonical registry and stores the runtime on a global symbol; every later
 * call returns the same object. Lookup connects nothing — `activate()` does
 * that, the first time a capability commits. The connection lives as long as
 * the document, so the disposer `connectWebMCP` returns is not stored —
 * nothing can call it. Tests that need a disposable connection call
 * `connectWebMCP` directly.
 *
 * Keyed off a global symbol so module duplication (HMR, multiple bundles)
 * still resolves to one canonical runtime.
 */
export function getAgentUIRuntime(): AgentUIRuntime {
  const host = globalThis as RuntimeHost
  const existing = host[RUNTIME_KEY]
  if (existing) return existing
  const registry = getCapabilityRegistry()
  let connected = false
  const runtime: AgentUIRuntime = {
    registry,
    activate() {
      if (connected) return
      connected = true
      connectWebMCP(registry)
    },
  }
  host[RUNTIME_KEY] = runtime
  return runtime
}
