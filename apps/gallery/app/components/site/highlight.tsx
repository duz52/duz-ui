/**
 * Static syntax highlighting with CodeMirror's grammar stack.
 *
 * Lezer is CodeMirror's parser and highlighter; used directly it colours a
 * string without an editor. That is the right shape for a documentation page:
 *
 * - the output is the same `<pre>` the page already rendered, with spans
 *   added, so highlighting costs zero layout shift by construction rather
 *   than by matching an editor's line boxes to it
 * - a code sample cannot take focus or swallow Tab, because there is nothing
 *   focusable in it
 * - it runs on the server, so the first painted frame is already coloured
 * - it ships the grammar, not the editor
 *
 * Colours are CSS variables the page redefines under `.dark`, so the theme
 * toggle recolours code with no second palette and no re-render.
 */

import { highlightTree, classHighlighter } from "@lezer/highlight"
import { parser as javascriptParser } from "@lezer/javascript"
import { parser as jsonParser } from "@lezer/json"

/** TypeScript with JSX: the dialect every `tsx` block on the site is written in. */
const tsx = javascriptParser.configure({ dialect: "ts jsx" })

/** Languages worth a grammar. `bash` blocks are one-line commands. */
const SUPPORTED = new Set(["tsx", "ts"])

export function isHighlightable(lang: string | undefined): boolean {
  return lang !== undefined && SUPPORTED.has(lang)
}

/**
 * The code as React nodes: highlighted ranges become spans carrying Lezer's
 * own `tok-*` class names, everything else stays text.
 */
function highlightWith(grammar: typeof tsx, code: string): React.ReactNode[] {
  const tree = grammar.parse(code)
  const nodes: React.ReactNode[] = []
  let position = 0

  const push = (from: number, to: number, className?: string) => {
    if (to <= from) return
    const text = code.slice(from, to)
    nodes.push(
      className ? (
        <span key={nodes.length} className={className}>
          {text}
        </span>
      ) : (
        text
      ),
    )
  }

  highlightTree(tree, classHighlighter, (from, to, className) => {
    push(position, from)
    push(from, to, className)
    position = to
  })
  push(position, code.length)

  return nodes
}

/** TypeScript with JSX. */
export function highlight(code: string): React.ReactNode[] {
  return highlightWith(tsx, code)
}

/** JSON: the shape of every tool payload the site displays. */
export function highlightJson(code: string): React.ReactNode[] {
  return highlightWith(jsonParser, code)
}
