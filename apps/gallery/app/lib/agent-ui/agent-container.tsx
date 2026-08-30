"use client"

/**
 * Agent UI — containment context.
 *
 * A capability rendered inside another capability's subtree usually belongs
 * to that container: a checkbox in a table row belongs to the table, not to
 * the page as one more anonymous root. The container tells the capabilities
 * rendered inside it who they belong to through this context, and
 * `useCapability` fills in from it whatever the caller did not state
 * explicitly. The context knows about containment — owner, position, order —
 * and nothing about any particular component.
 */

import * as React from "react"

export interface AgentContainer {
  /** Capability id of the container. Becomes each descendant's `owner`. */
  ownerId: string | undefined
  /**
   * What this position within the container is, e.g.
   * "row 3: ada@lovelace.dev". A container whose position name lives in text
   * that only exists once its subtree is mounted — a table row's first cell
   * — supplies a resolver instead of a string; the resolver runs when a
   * descendant capability registers, never during render.
   */
  itemLabel?: string | (() => string)
}

/**
 * Full shape of the context value. `claimItemPosition` is machinery for a
 * container that renders an ordered sequence of item slots (a table body):
 * a child occupying a slot claims its 1-based position by calling it once
 * during its own render, keyed by an identity stable across the render's
 * invocations, so a lone re-render of the child returns the position it
 * already holds and a fresh pass renumbers from 1.
 */
interface ContainerValue extends AgentContainer {
  claimItemPosition?: (identity: string) => number
}

const AgentContainerContext = React.createContext<ContainerValue | null>(null)

/**
 * Nesting composes: a provider inside a provider inherits `ownerId` and
 * `itemLabel` from the outer one unless it sets its own. That is what lets
 * `Table` set the owner once and `TableRow` set only the item it renders.
 */
export function AgentContainerProvider({
  ownerId,
  itemLabel,
  claimItemPosition,
  children,
}: {
  ownerId?: string
  itemLabel?: string | (() => string)
  claimItemPosition?: (identity: string) => number
  children: React.ReactNode
}) {
  const outer = React.useContext(AgentContainerContext)
  // Memoized so a container re-rendering for an unrelated reason (its own
  // capability registering) keeps the value identical and does not drag every
  // consumer in its subtree into a render it did not need.
  const value = React.useMemo<ContainerValue>(
    () => ({
      ownerId: ownerId ?? outer?.ownerId,
      itemLabel: itemLabel ?? outer?.itemLabel,
      ...(claimItemPosition ? { claimItemPosition } : {}),
    }),
    [ownerId, itemLabel, claimItemPosition, outer],
  )
  return (
    <AgentContainerContext.Provider value={value}>
      {children}
    </AgentContainerContext.Provider>
  )
}

/**
 * The container the calling capability sits in, or null when there is none —
 * a capability outside any container is an ordinary root, not an error.
 */
export function useAgentContainer(): AgentContainer | null {
  return React.useContext(AgentContainerContext)
}

/**
 * Claims the calling component's 1-based position in the ordered item
 * sequence its container renders, or null when no container offers one. The
 * component that occupies the slot calls this once per render; the claim is
 * keyed by the component's own identity, so a re-render — including
 * StrictMode's double invocation — returns the position already held instead
 * of taking another.
 */
export function useAgentItemPosition(): number | null {
  const container = React.useContext(AgentContainerContext)
  const identity = React.useId()
  return container?.claimItemPosition?.(identity) ?? null
}
