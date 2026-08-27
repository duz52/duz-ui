/**
 * Renderer for the `DocBlock` content model declared in `app/content/docs.ts`.
 *
 * Each block type maps to a typed element: paragraphs, headings, code blocks
 * and lists. Code blocks delegate to `<CodeBlock>` so they share the copy
 * button and horizontal-scroll behaviour with the rest of the site.
 */

import type { DocBlock } from "@/content/docs"
import { CodeBlock } from "./code-block"

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
                {block.text}
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
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}
