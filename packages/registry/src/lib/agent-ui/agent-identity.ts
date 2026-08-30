"use client"

import * as React from "react"

import type { AgentConfig, AgentProp } from "./use-capability"

/**
 * Agent UI — identity and naming helpers for agent-operable components.
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
 * 4. The element's own subtree text, for elements whose native accessible
 *    name IS that text: `<button>` and `<a>`. Other elements keep their own
 *    native mechanisms — a `<select>`'s name is never its options' text, a
 *    `<textarea>`'s never its default value — so their text content is not
 *    a name source.
 * 5. `fallback`.
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

function resolveAccessibleName(element: NamedElement, fallback: string): string {
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

  // 4. The element's own subtree text — a button or link's visible text.
  if (element.tagName === "BUTTON" || element.tagName === "A") {
    const label = normaliseText(element.textContent)
    if (label !== null) return capLength(label)
  }

  // 5. fallback
  return capLength(fallback)
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

    const resolved = resolveAccessibleName(element, fallback)
    if (resolved !== name) {
      setName(resolved)
    }
  })

  return name
}
