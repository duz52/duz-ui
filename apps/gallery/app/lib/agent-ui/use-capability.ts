"use client"

/**
 * Agent UI - React binding.
 *
 * Translates component-native behaviour into semantic capability actions.
 * React remains the canonical state owner: nothing here stores a copy of
 * component state, and every action result is read back from the component
 * after the application has committed the transition.
 */

import * as React from "react"

import { useAgentContainer } from "./agent-container"
import type { Capability, CapabilityResult, CapabilityState } from "./capability"
import { CapabilityError } from "./capability"
import { getAgentUIRuntime } from "./runtime"

/** Value of the `agent` prop that every agent-operable component accepts. */
export type AgentConfig = {
  /** Stable identity. Omit to receive a document-local generated identity. */
  id?: string
  /** Human-meaningful name the agent sees in discovery. */
  label?: string
  /** What this specific element is for, one sentence. */
  description?: string
  /** id of the capability that contains this one, when it is nested. */
  owner?: string
}

export type AgentProp = AgentConfig | boolean

export type ActionMap<Actions extends Record<string, unknown>> = {
  [Action in keyof Actions & string]: (
    input: Actions[Action],
  ) => unknown | Promise<unknown>
}

export interface UseCapabilityOptions<
  State extends CapabilityState,
  Actions extends Record<string, unknown>,
> {
  agent?: AgentProp
  kind: string
  /** Label used when the `agent` prop does not carry one. */
  defaultLabel?: string
  /**
   * What this element's id is derived from, resolved when the capability
   * registers rather than during render — the same shape a container uses for
   * `itemLabel`, and for the same reason: a name that lives in mounted text is
   * only readable once the element is mounted.
   *
   * Undefined, or a resolver returning undefined, means the element does not
   * know its own name; identity then falls back to the label, which is right
   * for an element whose name is a constant and provisional for one still
   * learning it. Kept apart from `defaultLabel` because the two answer
   * different questions: the label is description and keeps changing, the id
   * is addressing and must not move under an agent holding it.
   */
  identitySource?: () => string | undefined
  /** What this specific element is for, used when the `agent` prop does not carry one. */
  description?: string
  /** id of the containing capability, used when the `agent` prop does not carry one. */
  owner?: string
  /**
   * One-line digest of current state, when the component can say it better
   * than a generic formatter can.
   */
  summarise?: () => string
  read: () => State
  actions: ActionMap<Actions>
}

export interface CapabilityHandle {
  /**
   * Resolved identity, or undefined when the component opted out or has not
   * registered yet — identity is resolved at registration, never during
   * render.
   */
  id: string | undefined
  registered: boolean
}

/**
 * Resolves once React has had the chance to run the work an action scheduled.
 *
 * React's scheduler performs its work on a host task, and which host task
 * differs by environment: a `MessageChannel` message in browsers, a
 * `setImmediate` callback under Node. Two turns of the task queue land after
 * either. This is only the floor for the case where nothing commits at all,
 * because a real commit resolves the waiter the instant it happens, so the
 * bound costs the accepted path nothing.
 *
 * An update the application deliberately defers with `startTransition` can
 * still commit later than this. Reporting the state as it actually stands at
 * that moment is the honest answer, not something to compensate for.
 */
function afterReactFlush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => setTimeout(resolve, 0), 0)
  })
}

function resolveConfig(agent: AgentProp | undefined): AgentConfig | undefined {
  if (agent === false) return undefined
  if (agent === true || agent === undefined) return {}
  return agent
}

/**
 * Matches the shapes React's `useId()` produces — `«r1»`, `:r1:` and `_r_1_`
 * — including ids composed from one, such as shadcn Form's
 * `_r_57_-form-item`. The counter is base-32, so letters join the digits as
 * it advances (`_r_e_`), and hydration spells the marker uppercase
 * (`_R_1H1_`); the match is case-insensitive to cover both.
 *
 * Such an id is derived from the component's position in the React tree: it
 * changes whenever anything above the component changes and means nothing.
 * It is the very instability an agent-facing identity exists to escape, so it
 * is never adopted — an element carrying one is treated as carrying no id at
 * all, and identity falls through to the label-derived form.
 */
const REACT_GENERATED_ID = /«r[0-9a-v]+»|:r[0-9a-v]+:|_r_[0-9a-v]+_/i

function isReactGeneratedId(id: string): boolean {
  return REACT_GENERATED_ID.test(id)
}

export function useCapability<
  State extends CapabilityState,
  Actions extends Record<string, unknown>,
>(options: UseCapabilityOptions<State, Actions>): CapabilityHandle {
  const { agent, kind, defaultLabel, identitySource: identityResolver, description, owner, summarise, read, actions } =
    options

  const config = resolveConfig(agent)
  // The binding asks the runtime for the registry and knows nothing about
  // any protocol. Lookup is pure: it creates the runtime object and connects
  // nothing.
  const runtime = getAgentUIRuntime()
  const { registry } = runtime
  // The instance seed React assigned to this component. It is stable for the
  // component's lifetime, which is what lets the registry hand a
  // re-registering instance back the derived id it held before.
  const seed = React.useId()
  const container = useAgentContainer()
  const explicitLabel = config?.label
  const containerItemLabel = container?.itemLabel
  const containerItemKey = container?.itemKey
  // The `agent` prop wins over the option, exactly as it does for `label`.
  const resolvedDescription = config?.description ?? description
  // The `agent` prop wins over the option, and the option over the container
  // the capability was rendered inside.
  const resolvedOwner = config?.owner ?? owner ?? container?.ownerId
  // An explicit `agent.id` always wins — but an id in React's generated shape
  // is never adopted, whichever channel carried it in: an application that
  // forwards one is forwarding the same position-derived instability the
  // element-id channel must reject.
  const explicitId =
    config?.id !== undefined && !isReactGeneratedId(config.id) ? config.id : undefined
  const enabled = config !== undefined

  // The label the capability registers under. An explicit `agent.label` wins
  // over everything. Otherwise, when a container names the position this
  // capability occupies, the label is composed as
  // `${itemLabel} — ${defaultLabel}` — "row 3: ada@lovelace.dev — Checkbox".
  // A container whose position name lives in mounted text supplies a
  // resolver, so the composition runs when the capability registers, never
  // during render. With no container, `defaultLabel` is used unchanged.
  const resolveLabel = React.useCallback((): string | undefined => {
    if (explicitLabel !== undefined) return explicitLabel
    const itemLabel =
      typeof containerItemLabel === "function"
        ? containerItemLabel()
        : containerItemLabel
    if (itemLabel === undefined) return defaultLabel
    return defaultLabel === undefined
      ? itemLabel
      : `${itemLabel} — ${defaultLabel}`
  }, [explicitLabel, containerItemLabel, defaultLabel])

  // The source the capability's id is derived from, mirroring `resolveLabel`
  // with the container's `itemKey` in `itemLabel`'s place: the label may name
  // a position ("row 3: ada@lovelace.dev — Checkbox"), which is right for
  // display and wrong for identity, while the key names the item and nothing
  // else. A container that supplies a key whose resolver resolves to nothing
  // — a table row whose every cell is empty — leaves no stable identity to
  // derive, and the capability falls to the generated form rather than
  // carrying a position in its id.
  const resolveIdentitySource = React.useCallback((): string | undefined => {
    if (explicitLabel !== undefined) return explicitLabel
    const itemKey =
      typeof containerItemKey === "function" ? containerItemKey() : containerItemKey
    if (containerItemKey !== undefined && itemKey === undefined) return undefined
    const own = identityResolver?.()
    if (itemKey !== undefined) {
      const self = own ?? defaultLabel
      return self === undefined ? itemKey : `${itemKey} — ${self}`
    }
    return own ?? resolveLabel()
  }, [explicitLabel, containerItemKey, defaultLabel, identityResolver, resolveLabel])

  // The name this element knows itself by, captured the first time it knows
  // one. A label is description and keeps changing — a button reading "Run"
  // reads "Stop" once pressed — while an id is addressing and must not move
  // under an agent that is holding it. What is captured is the source, not the
  // id: the id still has to be re-derived while a mount settles, because a
  // child's effect runs before its container's, so the first registration sees
  // no owner and no container item key and only a later run can scope it
  // right. An element with no name of its own captures nothing and keeps
  // deriving from its label, which for it is a constant.
  const identitySourceRef = React.useRef<string | undefined>(undefined)

  const actionKey = Object.keys(actions).sort().join(" ")
  const actionNames = React.useMemo(
    () => actionKey.split(" ").filter(Boolean) as (keyof Actions & string)[],
    [actionKey],
  )

  const readRef = React.useRef(read)
  const actionsRef = React.useRef(actions)
  const summariseRef = React.useRef(summarise)
  const commitWaiters = React.useRef(new Set<() => void>())

  // Runs on every commit, before passive effects. Afterwards the refs hold the
  // committed render's closures, so a capability read always sees canonical
  // state rather than the state captured at registration time.
  React.useLayoutEffect(() => {
    readRef.current = read
    actionsRef.current = actions
    summariseRef.current = summarise
    if (commitWaiters.current.size === 0) return
    const pending = [...commitWaiters.current]
    commitWaiters.current.clear()
    for (const resolve of pending) resolve()
  })

  const waitForCommit = React.useCallback(() => {
    return new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        commitWaiters.current.delete(finish)
        resolve()
      }
      commitWaiters.current.add(finish)
      // No commit means the application did not accept the transition. Resolve
      // once React's scheduled work for this tick has run, so the result
      // reports the real, unchanged state instead of a manufactured success.
      void afterReactFlush().then(finish)
    })
  }, [])

  // Identity is a registration-time fact: it is resolved here, in the effect,
  // never during render — a container's item key lives in text that only
  // exists once the subtree is mounted, and the registry's discriminator
  // bookkeeping is a side effect a render must not run. The resolved id is
  // held in state so the handle can report it; a container that needs its id
  // during render (to name itself as owner) receives undefined for the first
  // pass, and its descendants re-register once the owner context carries the
  // real id.
  const [registeredId, setRegisteredId] = React.useState<string | undefined>(
    undefined,
  )

  React.useEffect(() => {
    if (!enabled) return

    // The adapter is connected because a capability committed, so a
    // discarded render connects nothing and `agent={false}` connects nothing.
    runtime.activate()

    // Identity precedence: an explicit `agent.id` wins; otherwise the id is
    // derived from what the capability can say about itself, scoped by its
    // owner; with nothing to say, the generated form is the last resort.
    if (explicitId === undefined && identitySourceRef.current === undefined) {
      identitySourceRef.current = identityResolver?.()
    }
    const identitySource =
      explicitId === undefined
        ? (identitySourceRef.current ?? resolveIdentitySource())
        : undefined
    const id =
      explicitId ??
      (identitySource !== undefined
        ? registry.deriveId(resolvedOwner, kind, identitySource, seed)
        : registry.createId(kind, seed))

    const capability: Capability<State, Actions> = {
      id,
      kind,
      label: resolveLabel(),
      description: resolvedDescription,
      owner: resolvedOwner,
      actions: actionNames,
      read: () => readRef.current(),
      // Routed through a ref like `read`, so the registered capability always
      // calls the committed render's summarise.
      summarise: summariseRef.current
        ? () => summariseRef.current?.()
        : undefined,
      async invoke(action, input): Promise<CapabilityResult<State>> {
        const handler = actionsRef.current[action]
        if (!handler) {
          throw new CapabilityError(
            "unsupported_action",
            `"${id}" does not support "${action}". Supported actions: ${actionNames.join(", ")}.`,
          )
        }
        // 1. The component performs the transition, the application decides.
        const detail = await handler(input)
        // 2. React commits whatever the application decided.
        await waitForCommit()
        // 3. The result is canonical state, read after the commit.
        return { state: readRef.current(), detail }
      },
    }

    const unregister = registry.register(capability as Capability)
    setRegisteredId(id)
    return () => {
      unregister()
      setRegisteredId(undefined)
    }
  }, [
    enabled,
    runtime,
    registry,
    explicitId,
    kind,
    resolveLabel,
    resolveIdentitySource,
    identityResolver,
    resolvedDescription,
    resolvedOwner,
    actionNames,
    waitForCommit,
    seed,
  ])

  return { id: registeredId, registered: registeredId !== undefined }
}
