"use client"

import * as React from "react"

import type { AgentConfig, AgentProp } from "./use-capability"

/**
 * Duz UI — identity and naming helpers for agent-operable components.
 *
 * The ordinary shadcn way of writing a form already carries both facts an
 * agent needs: an `id` for addressing and a `<label>` for description. These
 * helpers let a component read its own identity and its own name from what
 * the application already wrote, so the application needs no `agent` prop.
 *
 * Two facts, kept separate:
 *
 *  - `id` is canonical addressing: `agent.id` → the component's own `id`
 *    prop → a generated document-local id.
 *  - `label` is description: `agent.label` → `aria-label` →
 *    `aria-labelledby` → the associated `<label>` → the element's own text
 *    (a button or link's visible text is its native accessible name) → an
 *    intrinsic fallback.
 *
 * Never use the label as the id.
 */

/**
 * Fills in `id` from the element's own id attribute, without overriding an
 * explicit `agent.id`.
 *
 * Returns `false` unchanged — opting out stays opting out. Otherwise resolves
 * the prop to its config form and fills in `id` from `elementId` only when
 * the config does not already carry one. An explicit `agent.id` always wins.
 */
export function agentWithElementId(
  agent: AgentProp | undefined,
  elementId: string | undefined,
): AgentProp | undefined {
  if (agent === false) return false

  const config: AgentConfig =
    agent === true || agent === undefined ? {} : { ...agent }

  if (config.id === undefined && elementId !== undefined) {
    config.id = elementId
  }

  return config
}

/** Maximum length of a resolved accessible name. */
const NAME_MAX_LENGTH = 100

/**
 * Normalises text: trim, collapse internal whitespace runs to single
 * spaces. Returns null for an empty result so the caller can fall through.
 */
function normaliseText(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null
  const trimmed = text.trim()
  if (trimmed === "") return null
  return trimmed.replace(/\s+/g, " ")
}

/** Caps text at NAME_MAX_LENGTH characters. */
function capLength(text: string): string {
  return text.length > NAME_MAX_LENGTH ? text.slice(0, NAME_MAX_LENGTH) : text
}

/**
 * Resolves the accessible name of a mounted element, in this precedence:
 *
 * 1. `aria-label`, when non-empty after trimming.
 * 2. `aria-labelledby`: for each id in the attribute, the `textContent` of
 *    `document.getElementById(id)`, joined with a single space.
 * 3. The associated `<label>`: the element's `labels` collection when it has
 *    one (real form controls do); otherwise, when the element has an `id`,
 *    the first `label[for="<id>"]` in the document; otherwise
 *    `element.closest("label")`. Take its `textContent`.
 * 4. The element's own subtree text, when its role is one the accessible-name
 *    specification names from content — see NAME_FROM_CONTENT_ROLES. Other
 *    elements keep their own native mechanisms — a `<select>`'s name is never
 *    its options' text, a `<textarea>`'s never its default value — because
 *    their roles are not in that set.
 * Nothing found returns undefined; the caller supplies what to show.
 *
 * Each source is normalised (trim, collapse whitespace) and an empty result
 * falls through to the next source. The final result is capped at
 * NAME_MAX_LENGTH characters.
 */
/**
 * The surface of an element a name is read from — deliberately minimal and
 * structural. The helper reads attributes, labels and text and nothing else,
 * so it accepts a ref to any element. A nominal `HTMLElement` parameter
 * would refuse some elements outright: wrangler's generated worker types
 * merge an HTMLRewriter `Element` into the DOM lib's, which breaks
 * `HTMLSelectElement extends HTMLElement` assignability over the `remove()`
 * overloads — a member this helper never touches.
 */
interface NamedElement {
  id: string
  tagName: string
  textContent: string | null
  getAttribute(name: string): string | null
  closest(selectors: string): { textContent: string | null } | null
}

/**
 * Roles whose accessible name may come from the element's own content — ARIA's
 * "name from: author and content". Every other role is named by its author
 * alone, which is why a `<select>` is never named by its options and a
 * `<textarea>` never by its value: their roles are not in this set.
 */
const NAME_FROM_CONTENT_ROLES = new Set([
  "button",
  "cell",
  "checkbox",
  "columnheader",
  "gridcell",
  "heading",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "row",
  "rowheader",
  "switch",
  "tab",
  "tooltip",
  "treeitem",
])

/**
 * The role an element carries with none written on it. Only tags that map to a
 * name-from-content role are listed; anything absent falls through to "not
 * named from content", which is the safe answer.
 */
const IMPLICIT_ROLES = new Map([
  ["BUTTON", "button"],
  ["SUMMARY", "button"],
  ["OPTION", "option"],
  ["TD", "cell"],
  ["TH", "columnheader"],
  ["TR", "row"],
  ["H1", "heading"],
  ["H2", "heading"],
  ["H3", "heading"],
  ["H4", "heading"],
  ["H5", "heading"],
  ["H6", "heading"],
])

/**
 * Whether this element's text is its name.
 *
 * Decided by role rather than by tag, so a custom `<div role="button">` is
 * named exactly as a `<button>` is — the common way to write an interactive
 * element that is not a native control, and previously invisible here. A
 * written role wins over the implicit one, as it does everywhere in ARIA, and
 * an `<a>` is a link only when it has an href.
 */
function namesFromContent(element: NamedElement): boolean {
  const written = element.getAttribute("role")?.trim().split(/\s+/)[0]
  if (written) return NAME_FROM_CONTENT_ROLES.has(written)
  if (element.tagName === "A") return element.getAttribute("href") !== null
  const implicit = IMPLICIT_ROLES.get(element.tagName)
  return implicit !== undefined && NAME_FROM_CONTENT_ROLES.has(implicit)
}

function resolveAccessibleName(element: NamedElement): string | undefined {
  // 1. aria-label
  const ariaLabel = normaliseText(element.getAttribute("aria-label"))
  if (ariaLabel !== null) return capLength(ariaLabel)

  // 2. aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby")
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((target): target is HTMLElement => target !== null)
      .map((target) => target.textContent ?? "")
      .join(" ")
    const label = normaliseText(text)
    if (label !== null) return capLength(label)
  }

  // 3. Associated <label>
  // 3a. labels collection (real form controls)
  if ("labels" in element) {
    const labels = (element as HTMLInputElement).labels
    if (labels && labels.length > 0) {
      const label = normaliseText(labels[0]?.textContent)
      if (label !== null) return capLength(label)
    }
  }

  // 3b. label[for="<id>"]
  if (element.id) {
    const escapedId = element.id.replace(/["\\]/g, "\\$&")
    const labelEl = document.querySelector(`label[for="${escapedId}"]`)
    if (labelEl) {
      const label = normaliseText(labelEl.textContent)
      if (label !== null) return capLength(label)
    }
  }

  // 3c. closest("label")
  const closestLabel = element.closest("label")
  if (closestLabel) {
    const label = normaliseText(closestLabel.textContent)
    if (label !== null) return capLength(label)
  }

  // 4. The element's own subtree text, when its role is named from content.
  if (namesFromContent(element)) {
    const label = normaliseText(element.textContent)
    if (label !== null) return capLength(label)
  }

  // Nothing named it. The caller owns what to show instead.
  return undefined
}

/**
 * Returns `fallback` until the element is mounted, then the element's
 * accessible name resolved from the DOM.
 *
 * Resolved in `useLayoutEffect` with no dependency array, so it runs on every
 * commit and follows a label whose text changes. The element does not exist
 * during render, and reading layout-adjacent DOM before paint is what layout
 * effects are for. The setter is called only when the resolved value actually
 * differs from what is already in state, otherwise every commit would
 * schedule a render and the component would loop.
 *
 * This reads the DOM for a *name*, never to drive a transition — dispatch
 * still goes registry → capability → component.
 */
export function useAccessibleName(
  ref: React.RefObject<NamedElement | null>,
  fallback: string,
): string {
  const [name, setName] = React.useState(fallback)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const resolved = resolveAccessibleName(element) ?? fallback
    if (resolved !== name) {
      setName(resolved)
    }
  })

  return name
}

/**
 * The same name, as a resolver the capability runs when it registers.
 *
 * `useAccessibleName` answers "what should this element be called right now",
 * and its state is one commit behind the DOM on the first render — which is
 * fine for description and wrong for identity, because an id derived from that
 * first value would be derived from the fallback and then frozen. This reads
 * the DOM at the moment the capability registers, when the element is mounted
 * and its real name is already there.
 *
 * Returns undefined when nothing names the element, so identity falls back to
 * the label rather than to a name the element does not have.
 */
export function useAccessibleNameResolver(
  ref: React.RefObject<NamedElement | null>,
): () => string | undefined {
  return React.useCallback(() => {
    const element = ref.current
    return element ? resolveAccessibleName(element) : undefined
  }, [ref])
}
