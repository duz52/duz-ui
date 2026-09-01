/**
 * Renderer for the `DocBlock` content model declared in `app/content/docs.ts`.
 *
 * Each block type maps to a typed element: paragraphs, headings, code blocks
 * and lists. Code blocks delegate to `<CodeBlock>` so they share the copy
 * button and horizontal-scroll behaviour with the rest of the site.
 *
 * Prose carries one piece of inline markup, the backtick, and it is rendered
 * rather than shown. The content model has always written `duz-ui migrate`
 * and `document.modelContext` in backticks; without this they reached the page
 * as literal grave accents, which is how an unrendered markdown file looks.
 */

import type { DocBlock } from "@/content/docs"
import { CodeBlock } from "./code-block"

const INLINE_CODE_CLASS =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"

/**
 * Splits prose on backtick pairs, rendering the enclosed runs as `<code>`.
 *
 * The split keeps the delimiters' contents as odd-indexed entries, so a text
 * with no backticks — or an unclosed one — yields a single entry and passes
 * through unchanged. Nesting is not a case: a backtick run ends at the next
 * backtick.
 */
function inline(text: string): React.ReactNode {
  const parts = text.split("`")
  if (parts.length === 1) return text
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className={INLINE_CODE_CLASS}>
        {part}
      </code>
    ) : (
      part
    ),
  )
}

export function DocBody({ blocks }: { blocks: DocBlock[] }): React.JSX.Element {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p
                key={index}
                className="text-sm leading-relaxed text-foreground/90"
              >
                {inline(block.text)}
              </p>
            )
          case "h2":
            return (
              <h2
                key={index}
                className="pt-4 text-lg font-semibold tracking-tight"
              >
                {block.text}
              </h2>
            )
          case "code":
            return (
              <CodeBlock key={index} code={block.code} lang={block.lang} />
            )
          case "list":
            return (
              <ul
                key={index}
                className="list-disc space-y-1 pl-6 text-sm leading-relaxed text-foreground/90"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item)}</li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}
