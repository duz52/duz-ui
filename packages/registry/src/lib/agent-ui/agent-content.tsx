"use client"

/**
 * Agent UI — explicit content wrapper.
 *
 * Content the application renders itself — a chart, a paragraph, a whole
 * panel of markup — carries no capability, so discovery never reports it and
 * an agent cannot read a word of it. `AgentContent` is the escape hatch: it
 * registers a capability of kind `"content"` whose `read()` reports the
 * normalised text of its own subtree. Like `AgentAction`, it is a semantics
 * wrapper, not a UI element — it renders its children unchanged.
 */

import * as React from "react"

import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"

/**
 * Tags that end a line of reading.
 *
 * `textContent` concatenates with no separator, so a card whose value and
 * delta sit in sibling blocks reads as "$45,231.89+20.1% from last month" —
 * two facts fused into one token that an agent can misparse as arithmetic.
 * Boundaries are restored from the tag name rather than from layout: asking
 * for computed styles would make the cost of a read grow with the size of the
 * subtree being read, on a path an agent calls.
 */
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "DD", "DIV", "DL", "DT",
  "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4",
  "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION",
  "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL",
])

// DOM node type constants, spelled out because `Node` is not a global in
// every environment these components are read in.
const TEXT_NODE = 3
const ELEMENT_NODE = 1

function collectText(node: Node, into: string[]): void {
  if (node.nodeType === TEXT_NODE) {
    into.push(node.nodeValue ?? "")
    return
  }
  if (node.nodeType !== ELEMENT_NODE) return
  const isBlock = BLOCK_TAGS.has((node as Element).tagName)
  if (isBlock) into.push(" ")

  // Two element siblings with nothing between them are two separate things a
  // person sees held apart by layout: `<span>Active</span><span>127</span>`
  // reads as "Active127" through textContent. An element sitting *between*
  // text is the opposite case — the bold in "Hello <b>world</b>!" is one
  // phrase — so the separator goes only between adjacent elements.
  let previousWasElement = false
  for (const child of node.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      if (previousWasElement) into.push(" ")
      previousWasElement = true
    } else if (
      child.nodeType === TEXT_NODE &&
      (child.nodeValue ?? "").trim() !== ""
    ) {
      previousWasElement = false
    }
    collectText(child, into)
  }

  if (isBlock) into.push(" ")
}

/**
 * Reads an element's text the way a person reads it: block boundaries become
 * spaces, whitespace runs collapse to one, and the result is capped at
 * `maxLength` with a trailing ellipsis. Every content capability — card
 * fields, table cells, an `AgentContent` subtree — reports text through this
 * one shape. An absent element reads as the empty string.
 */
export function readText(element: Element | null | undefined, maxLength: number): string {
  if (!element) return ""
  const parts: string[] = []
  collectText(element, parts)
  const text = parts.join("").trim().replace(/\s+/g, " ")
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

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
  useCapability<AgentContentState, Record<string, never>>({
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

  return <div ref={mergedRef} data-slot="agent-content" {...props} />
}
