/**
 * Duz UI — reading an element's text the way a person reads it.
 *
 * `textContent` concatenates with no separator, which fuses facts that layout
 * holds apart. A card whose value and delta sit in sibling blocks reads as
 * "$45,231.89+20.1% from last month" — two facts in one token an agent can
 * misparse as arithmetic. A palette row reads as "DataTableA TanStack-powered
 * data table…", and a paginator button as "Go to page 5050".
 *
 * Boundaries are restored from the tag name rather than from layout: asking
 * for computed styles would make the cost of a read grow with the size of the
 * subtree being read, on a path an agent calls.
 *
 * This lives on its own rather than inside any one component because it is not
 * any one component's: content capabilities, table cells, card fields, toasts
 * and the accessible-name resolver all report text through this one shape.
 */

/** Tags that end a line of reading. */
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

/**
 * The surface text is read from — deliberately structural and minimal, for the
 * same reason `NamedElement` in agent-identity.ts is: a nominal `Node`
 * parameter would refuse elements in a host whose DOM lib disagrees with this
 * one, over members this file never touches. Wrangler's generated worker types
 * are that host.
 */
export interface ReadableNode {
  nodeType: number
  nodeValue: string | null
  childNodes: ArrayLike<ReadableNode>
  /** Absent on text nodes, which is how the union stays assignable. */
  tagName?: string
}

function collectText(node: ReadableNode, into: string[]): void {
  if (node.nodeType === TEXT_NODE) {
    into.push(node.nodeValue ?? "")
    return
  }
  if (node.nodeType !== ELEMENT_NODE) return
  const isBlock = BLOCK_TAGS.has(node.tagName ?? "")
  if (isBlock) into.push(" ")

  // Two element siblings with nothing between them are two separate things a
  // person sees held apart by layout: `<span>Active</span><span>127</span>`
  // reads as "Active127" through textContent. An element sitting *between*
  // text is the opposite case — the bold in "Hello <b>world</b>!" is one
  // phrase — so the separator goes only between adjacent elements.
  let previousWasElement = false
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes[index]
    if (!child) continue
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
 * An element's text: block boundaries become spaces, whitespace runs collapse
 * to one, and the result is capped at `maxLength` with a trailing ellipsis. An
 * absent element reads as the empty string.
 */
export function readText(
  element: ReadableNode | null | undefined,
  maxLength: number,
): string {
  if (!element) return ""
  const parts: string[] = []
  collectText(element, parts)
  const text = parts.join("").trim().replace(/\s+/g, " ")
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}
