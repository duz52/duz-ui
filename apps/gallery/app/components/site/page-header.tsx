/**
 * Page title block with an optional eyebrow and description.
 */

export function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string
  description?: string
  eyebrow?: string
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="font-mono text-xs text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
