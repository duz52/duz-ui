/**
 * A JSON payload, rendered to be read rather than scrolled.
 *
 * Tool results arrive as the compact string `serialise()` produces, because
 * that is what goes over the wire to an agent. Shown verbatim in a column,
 * one long line forces a horizontal scrollbar and the payload becomes
 * unreadable — which is what it did in the playground's 360px console. So the
 * wire form is re-indented for display and wrapped, never scrolled sideways.
 *
 * A payload that does not parse is shown exactly as it arrived: a runner that
 * silently prettified nothing would hide the fact that the tool returned
 * something other than JSON.
 *
 * Payloads get the same Lezer treatment as code blocks, with the JSON grammar.
 */

import { highlightJson } from "@/components/site/highlight"
import { cn } from "@/lib/utils"

function format(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    return payload
  }
}

export function JsonBlock({
  payload,
  tone = "default",
  className,
}: {
  payload: string
  /** Refusals and failures read as results, not as crashes — only the tone differs. */
  tone?: "default" | "refused" | "error"
  className?: string
}): React.JSX.Element {
  return (
    <pre
      className={cn(
        // `break-all`, not `break-words`: a long id or URL inside a JSON string
        // has no spaces to break at, and is exactly the case that overflowed.
        "overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed",
        tone === "refused" && "border-amber-500/40",
        tone === "error" && "border-destructive/40 text-destructive",
        className,
      )}
    >
      <code>
        {/* A payload that is not JSON falls back to the verbatim string, and
            the JSON grammar has nothing to tag in it — it renders plain, which
            is correct: it is shown exactly as it arrived. */}
        {highlightJson(format(payload))}
      </code>
    </pre>
  )
}
