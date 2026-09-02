"use client"

/**
 * Duz UI — explicit content wrapper.
 *
 * Content the application renders itself — a chart, a paragraph, a whole
 * panel of markup — carries no capability, so discovery never reports it and
 * an agent cannot read a word of it. `AgentContent` is the escape hatch: it
 * registers a capability of kind `"content"` whose `read()` reports the
 * normalised text of its own subtree. Like `AgentAction`, it is a semantics
 * wrapper, not a UI element — it renders its children unchanged.
 *
 * It is also their container: a capability inside it is reported as its child
 * rather than as one more root of the page.
 */

import * as React from "react"

import { readText } from "@/lib/duz-ui/read-text"
import { AgentContainerProvider } from "@/lib/duz-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"

/** Cap for the text reported for the wrapper's whole subtree. */
const SUBTREE_MAX_LENGTH = 2000

export interface AgentContentProps extends React.ComponentProps<"div"> {
  /** The capability's label, shown by `ui_list`. */
  label: string
  /** What the content is; reported with every read, like AgentAction's. */
  description?: string
  /**
   * The content as data, for content a person reads but text cannot carry.
   *
   * A chart is the case this exists for: its numbers are geometry, so the
   * subtree's text is empty however carefully it is read. The application
   * already holds the series it passed to the chart library, so it states it
   * here rather than having anything try to reconstruct it from the SVG.
   * Must be JSON-serialisable.
   */
  value?: unknown
  agent?: AgentProp
}

type AgentContentState = {
  text: string
  description: string | null
  value: unknown
}

export function AgentContent({
  label,
  description,
  value,
  agent,
  ref,
  ...props
}: AgentContentProps) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(ref, elementRef)

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect. That is what makes
  // registering a whole content subtree affordable.
  const { id } = useCapability<AgentContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: label,
    read: () => ({
      text: readText(elementRef.current, SUBTREE_MAX_LENGTH),
      description: description ?? null,
      // Reported unconditionally: an agent must be able to tell content that
      // carries no data from content whose data happens to be absent.
      value: value ?? null,
    }),
    actions: {},
  })

  // A capability rendered inside this content belongs to it — the same rule
  // `Table` and `Command` already follow, and for the same reason: a wrapper
  // that names a panel should own what the panel contains, or its contents are
  // listed flat beside the page's own furniture as if they were unrelated.
  // With `agent={false}` the id is undefined and descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <div ref={mergedRef} data-slot="agent-content" {...props} />
    </AgentContainerProvider>
  )
}
