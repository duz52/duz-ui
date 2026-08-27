/**
 * Copy-to-clipboard button.
 *
 * Renders a placeholder until after mount so the server-rendered HTML and the
 * first client render match — `navigator.clipboard` is a browser-only API and
 * must not be touched during SSR or hydration.
 */

import { useEffect, useState } from "react"

export function CopyButton({ value }: { value: string }): React.JSX.Element {
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span className="inline-block h-7 w-12" aria-hidden />
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      // Clipboard access is best-effort: the code stays visible regardless.
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center rounded-md border border-border bg-background/80 px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? "copied" : "copy"}
    </button>
  )
}
