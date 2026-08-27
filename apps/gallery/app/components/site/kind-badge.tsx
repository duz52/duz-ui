/**
 * Small mono badge that marks a component as agent-operable and names its
 * capability kind (e.g. `data-table`, `tabs`). The mono font is the visual
 * signal: prose in Inter, machine surface in mono.
 */

export function KindBadge({ kind }: { kind: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
      {kind}
    </span>
  )
}
