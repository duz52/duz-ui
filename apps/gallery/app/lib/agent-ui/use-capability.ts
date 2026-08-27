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

import type { Capability, CapabilityResult, CapabilityState } from "./capability"
import { CapabilityError } from "./capability"
import { getAgentUIRuntime } from "./runtime"

/** Value of the `agent` prop that every agent-operable component accepts. */
export type AgentConfig = {
  /** Stable identity. Omit to receive a document-local generated identity. */
  id?: string
  /** Human-meaningful name the agent sees in discovery. */
  label?: string
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
  read: () => State
  actions: ActionMap<Actions>
}

export interface CapabilityHandle {
  /** Resolved identity, or undefined when the component opted out. */
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

export function useCapability<
  State extends CapabilityState,
  Actions extends Record<string, unknown>,
>(options: UseCapabilityOptions<State, Actions>): CapabilityHandle {
  const { agent, kind, defaultLabel, read, actions } = options

  const config = resolveConfig(agent)
  // The binding asks the runtime for the registry and knows nothing about
  // any protocol. Lookup is pure: it creates the runtime object and connects
  // nothing.
  const runtime = getAgentUIRuntime()
  const { registry } = runtime
  const generatedId = registry.createId(kind, React.useId())
  const id = config ? (config.id ?? generatedId) : undefined
  const label = config?.label ?? defaultLabel

  const actionKey = Object.keys(actions).sort().join(" ")
  const actionNames = React.useMemo(
    () => actionKey.split(" ").filter(Boolean) as (keyof Actions & string)[],
    [actionKey],
  )

  const readRef = React.useRef(read)
  const actionsRef = React.useRef(actions)
  const commitWaiters = React.useRef(new Set<() => void>())

  // Runs on every commit, before passive effects. Afterwards the refs hold the
  // committed render's closures, so a capability read always sees canonical
  // state rather than the state captured at registration time.
  React.useLayoutEffect(() => {
    readRef.current = read
    actionsRef.current = actions
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

  const [registered, setRegistered] = React.useState(false)

  React.useEffect(() => {
    if (!id) return

    // The adapter is connected because a capability committed, so a
    // discarded render connects nothing and `agent={false}` connects nothing.
    runtime.activate()

    const capability: Capability<State, Actions> = {
      id,
      kind,
      label,
      actions: actionNames,
      read: () => readRef.current(),
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
    setRegistered(true)
    return () => {
      unregister()
      setRegistered(false)
    }
  }, [runtime, registry, id, kind, label, actionNames, waitForCommit])

  return { id, registered }
}
