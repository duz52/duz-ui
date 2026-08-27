/**
 * Flowing-text wrapper. Applies consistent vertical rhythm and readable line
 * height to paragraphs of documentation prose.
 */

export function Prose({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      {children}
    </div>
  )
}
