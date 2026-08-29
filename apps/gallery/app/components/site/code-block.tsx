/**
 * Code block with an optional copy button.
 *
 * Every code block shares the same surface: a bordered, muted, monospaced
 * panel that scrolls horizontally. Wide tables and code never force the page
 * body to scroll sideways.
 *
 * Highlighting is static and server-rendered — see `highlight.tsx` for why an
 * editor is the wrong tool here.
 */

import { CopyButton } from "./copy-button"
import { highlight, isHighlightable } from "./highlight"

export function CodeBlock({
  code,
  lang,
  copy = true,
}: {
  code: string
  lang?: string
  copy?: boolean
}): React.JSX.Element {
  return (
    <div className="relative rounded-lg border border-border bg-muted/40">
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{isHighlightable(lang) ? highlight(code) : code}</code>
      </pre>
      {copy ? (
        <div className="absolute right-2 top-2">
          <CopyButton value={code} />
        </div>
      ) : null}
    </div>
  )
}
