/**
 * Page title block with an optional eyebrow and description.
 *
 * It also states the page's identity to an agent, through the same two strings
 * a person reads. `AgentPage` renders nothing, so dropping it into a route on
 * its own would be a capability with no visible counterpart — a second
 * interface. Here it is carried by the component that renders the heading, so
 * the page says what it is exactly once, to both readers.
 */

import { AgentPage } from "@/lib/duz-ui/agent-page"

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
      <AgentPage title={title} description={description} />
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
