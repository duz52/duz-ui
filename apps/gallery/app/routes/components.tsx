import { Link } from "react-router"

import type { Route } from "./+types/components"
import { listItems, type GalleryItem } from "@/registry"
import { PageHeader } from "@/components/site/page-header"
import { KindBadge } from "@/components/site/kind-badge"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Components — Agent UI" }]
}

export function loader({}: Route.LoaderArgs): { items: GalleryItem[] } {
  return { items: listItems() }
}

const EXPLICIT_REASON =
  "A button cannot know what onClick means, so it never becomes an automatic agent action. Wrap it in <AgentAction> to expose business semantics."

export default function Components({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { items } = loaderData

  const agentNative = items.filter(
    (i) => i.agentUi?.status === "agent-native",
  )
  const presentation = items.filter(
    (i) => i.agentUi?.status === "presentation",
  )
  const explicit = items.filter(
    (i) => i.agentUi?.status === "explicit-semantics",
  )

  return (
    <div className="space-y-12 py-8">
      <PageHeader
        title="Components"
        description="Agent-native React components built on the shadcn registry."
      />

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Agent-native
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {agentNative.map((item) => (
            <Link
              key={item.name}
              to={`/components/${item.name}`}
              className="space-y-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.title}</span>
                {item.agentUi ? <KindBadge kind={item.agentUi.kind} /> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
              {item.agentUi ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.agentUi.actions.map((action) => (
                    <code
                      key={action}
                      className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {action}
                    </code>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Presentation only
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {presentation.map((item) => (
            <li key={item.name} className="p-4">
              <p className="font-medium text-muted-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground/80">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Requires explicit semantics
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {explicit.map((item) => (
            <li key={item.name} className="p-4">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {EXPLICIT_REASON}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
