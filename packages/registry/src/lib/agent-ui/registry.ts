/**
 * Agent UI — capability registry.
 *
 * Exactly one live registry per document runtime. Registration defines
 * availability; unregistration defines disappearance. There is no
 * reconciliation loop, no DOM scan and no shadow inventory.
 */

import {
  CapabilityError,
  describe,
  type Capability,
  type CapabilityDescriptor,
  type CapabilityResult,
  type CapabilityState,
} from "./capability"

export interface CapabilityRegistry {
  register(capability: Capability): () => void
  get(id: string): Capability | undefined
  list(): Capability[]
  listByKind(kind: string): Capability[]
  listKinds(): string[]
  /** Stable snapshot of every live capability, replaced only when the set changes. */
  describeAll(): CapabilityDescriptor[]
  /** Canonical semantic state of one capability. */
  read(id: string): CapabilityState
  invoke(id: string, action: string, input: unknown): Promise<CapabilityResult>
  /** Notified whenever the set of live capabilities changes. */
  subscribe(listener: () => void): () => void
  /** Document-local identity for a capability that did not supply one. */
  createId(kind: string, seed: string): string
}

function createRegistry(): CapabilityRegistry {
  const capabilities = new Map<string, Capability>()
  const listeners = new Set<() => void>()
  // Snapshot for `useSyncExternalStore`. Held here because the registry is the
  // only thing that knows when the set of capabilities actually changed.
  let snapshot: CapabilityDescriptor[] | undefined

  const notify = () => {
    snapshot = undefined
    for (const listener of [...listeners]) listener()
  }

  const requireCapability = (id: string): Capability => {
    const capability = capabilities.get(id)
    if (!capability) {
      const known = [...capabilities.keys()]
      throw new CapabilityError(
        "unknown_target",
        known.length
          ? `No UI element with id "${id}" is on the page. Available ids: ${known.join(", ")}.`
          : `No UI element with id "${id}" is on the page. There are no agent-operable elements right now.`,
      )
    }
    return capability
  }

  return {
    register(capability) {
      const existing = capabilities.get(capability.id)
      if (existing && existing !== capability) {
        throw new Error(
          `Agent UI: duplicate capability id "${capability.id}". ` +
            `Every mounted capability must have exactly one identity — give one of them a distinct \`agent.id\`.`,
        )
      }
      capabilities.set(capability.id, capability)
      notify()
      return () => {
        if (capabilities.get(capability.id) === capability) {
          capabilities.delete(capability.id)
          notify()
        }
      }
    },

    get(id) {
      return capabilities.get(id)
    },

    list() {
      return [...capabilities.values()]
    },

    listByKind(kind) {
      return [...capabilities.values()].filter((c) => c.kind === kind)
    },

    listKinds() {
      return [...new Set([...capabilities.values()].map((c) => c.kind))].sort()
    },

    describeAll() {
      snapshot ??= [...capabilities.values()].map(describe)
      return snapshot
    },

    read(id) {
      return requireCapability(id).read()
    },

    async invoke(id, action, input) {
      const capability = requireCapability(id)
      if (!capability.actions.includes(action)) {
        throw new CapabilityError(
          "unsupported_action",
          `"${id}" is a ${capability.kind} and does not support "${action}". Supported actions: ${capability.actions.join(", ")}.`,
        )
      }
      return capability.invoke(action, input as never)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    createId(kind, seed) {
      return `${kind}_${seed.replace(/[^a-zA-Z0-9_-]/g, "")}`
    },
  }
}

const REGISTRY_KEY = Symbol.for("agent-ui.capability-registry")

type RegistryHost = { [REGISTRY_KEY]?: CapabilityRegistry }

/**
 * The single live registry for this document runtime. Keyed off a global
 * symbol so module duplication (HMR, multiple bundles) still resolves to one
 * canonical index.
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  const host = globalThis as RegistryHost
  const existing = host[REGISTRY_KEY]
  if (existing) return existing
  const registry = createRegistry()
  host[REGISTRY_KEY] = registry
  return registry
}
