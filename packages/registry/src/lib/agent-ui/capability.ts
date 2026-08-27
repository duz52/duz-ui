/**
 * Agent UI — capability kernel.
 *
 * A capability is one mounted semantic UI surface. It knows nothing about
 * WebMCP, shadcn, the DOM, the CLI or codemods. It only knows how to report
 * its own semantic state and how to perform its own semantic actions.
 */

/** Semantic state and action result of a capability, always JSON-serialisable. */
export type CapabilityState = Record<string, unknown>

export interface Capability<
  State extends CapabilityState = CapabilityState,
  Actions extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  kind: string
  label?: string

  /**
   * Names of the actions this capability supports. Discovery cannot be
   * reconstructed from anywhere else, so the capability declares it.
   */
  actions: readonly (keyof Actions & string)[]

  read(): State

  invoke<Action extends keyof Actions & string>(
    action: Action,
    input: Actions[Action],
  ): Promise<CapabilityResult<State>>
}

/**
 * Result of one semantic action.
 *
 * `state` is read from the component *after* the application has committed the
 * transition, so it is the canonical post-transition state — never a
 * manufactured echo of the request.
 */
export interface CapabilityResult<State extends CapabilityState = CapabilityState> {
  state: State
  /** Optional action-specific return value, e.g. how many rows matched. */
  detail?: unknown
}

/** Machine-readable reasons a semantic dispatch was rejected. */
export type CapabilityErrorCode =
  | "unknown_target"
  | "unsupported_action"
  | "invalid_input"
  | "rejected"

/**
 * Rejection of an agent request. The message is written for an agent to
 * self-correct from and must never carry stack traces, provider names or
 * other internals.
 */
export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode

  constructor(code: CapabilityErrorCode, message: string) {
    super(message)
    this.name = "CapabilityError"
    this.code = code
  }
}

/** Discovery descriptor produced by the registry, never by a component. */
export interface CapabilityDescriptor {
  id: string
  kind: string
  label?: string
  actions: readonly string[]
}

export function describe(capability: Capability): CapabilityDescriptor {
  return {
    id: capability.id,
    kind: capability.kind,
    label: capability.label,
    actions: capability.actions,
  }
}
