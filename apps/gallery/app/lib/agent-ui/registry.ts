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
  /**
   * The capability with this id, or a refusal an agent can correct from.
   *
   * `get` is for a caller that treats absence as ordinary — a UI reading a
   * stale snapshot. `require` is for a caller acting on an agent's request,
   * where absence is something the agent must be told about. Neither reads
   * state: resolving an id must not cost what reading it costs.
   */
  require(id: string): Capability
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
  /** Document-local identity for a capability that resolved no label. */
  createId(kind: string, seed: string): string
  /**
   * Reserves a deterministic document-local id derived from what the
   * capability can say about itself: `[owner, kind, slug(source)]`, joined
   * with dots, capped at 120 characters and stripped to tool-name-safe
   * characters.
   *
   * Two capabilities may derive the same base — two "Delete" buttons under
   * one owner — so the id is made unique with a numeric discriminator: the
   * first instance takes the bare base, later ones `base.2`, `base.3`, ….
   *
   * The discriminator belongs to the capability INSTANCE (`seed` — React's
   * useId, stable for the instance's lifetime), not to the moment of
   * registration: the registry remembers the number each seed held, and a
   * re-registering instance reclaims it no matter how registration and
   * unregistration interleave. That is what defeats the case where a new
   * capability registers before its predecessor unregisters — there,
   * "append the next free number" hands out a different id and the churn
   * this scheme exists to remove comes straight back. A fresh instance takes
   * the lowest number no live capability holds and forgets the dead instance
   * that held it, so the memory per base stays bounded by the base's peak
   * live instances and a remount — a dialog closed and reopened, whose
   * content carries new seeds — numbers from 1 again and lands on the ids it
   * had before.
   */
  deriveId(
    owner: string | undefined,
    kind: string,
    source: string,
    seed: string,
  ): string
}

/** Characters an id may carry and still be a safe tool name. */
const UNSAFE_ID_CHARACTERS = /[^a-zA-Z0-9_.-]/g

/** A derived id is capped so a long label cannot produce an unbounded name. */
const DERIVED_ID_MAX_LENGTH = 120

/**
 * Reduces a resolved label to the slug a derived id carries:
 * "Invite User" → "invite-user". Runs of anything outside latin letters and
 * digits collapse into one separator, so the result stays tool-name-safe.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** The base id itself for discriminator 1, `base.2`, `base.3`, … after it. */
function numberedId(base: string, number: number): string {
  return number === 1 ? base : `${base}.${number}`
}

function createRegistry(): CapabilityRegistry {
  const capabilities = new Map<string, Capability>()
  const listeners = new Set<() => void>()
  // Per derived base: the discriminator number each capability instance (its
  // React useId seed) held when it last registered. Entries are forgotten
  // when a fresh instance reuses their number, which keeps the memory per
  // base bounded by the base's peak live instances.
  const derivedNumbers = new Map<string, Map<string, number>>()

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

    require(id) {
      return requireCapability(id)
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

    deriveId(owner, kind, source, seed) {
      const base = [owner, kind, slugify(source)]
        .filter((part) => part !== undefined && part !== "")
        .join(".")
        .replace(UNSAFE_ID_CHARACTERS, "")
        .slice(0, DERIVED_ID_MAX_LENGTH)
      let numbers = derivedNumbers.get(base)
      if (!numbers) {
        numbers = new Map()
        derivedNumbers.set(base, numbers)
      }

      // A re-registering instance reclaims the discriminator it held.
      const remembered = numbers.get(seed)
      if (remembered !== undefined) {
        const candidate = numberedId(base, remembered)
        if (!capabilities.has(candidate)) return candidate
        // The seed's slot is held by another live capability — two document
        // roots can share a useId seed — so this registration takes a fresh
        // number below without displacing the remembered one.
      }

      // A fresh instance takes the lowest number no live capability holds;
      // the dead instance that held it is forgotten.
      let number = 1
      while (capabilities.has(numberedId(base, number))) number += 1
      for (const [holder, held] of numbers) {
        if (held === number) {
          numbers.delete(holder)
          break
        }
      }
      numbers.set(seed, number)
      return numberedId(base, number)
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
