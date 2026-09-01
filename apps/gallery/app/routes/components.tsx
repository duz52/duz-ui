import { Link, useParams, useRouteLoaderData } from "react-router"

import type { Route } from "./+types/components"
import { basesOf, listItems, type GalleryIndexItem } from "@/registry"
import { KindBadge } from "@/components/site/kind-badge"
import { PageHeader } from "@/components/site/page-header"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Components — Duz UI" }]
}

type GalleryItemStatus = NonNullable<GalleryIndexItem["agentUi"]>["status"]

// Ordered to answer the reader's first question: what an agent can operate
// directly, what needs the app's meaning first, and what is display-only.
const GROUPS: { status: GalleryItemStatus; label: string; note: string }[] = [
  {
    status: "agent-native",
    label: "Agent-native",
    note: "Registers a capability. An agent can read its state and act on it.",
  },
  {
    status: "presentation",
    label: "Presentation",
    note: "No capability. Layout and display only.",
  },
]

export default function Components(): React.JSX.Element {
  const index =
    useRouteLoaderData<{ items: GalleryIndexItem[] }>("routes/gallery-layout")
      ?.items ?? []
  // This route has no base in the URL, so `base` is always undefined here.
  // Any base keeps the links addressable; the first registry-derived one is
  // the deterministic choice, the same one the sidebar makes.
  const activeBase = useParams().base ?? basesOf(index)[0] ?? ""
  const items = listItems(index, activeBase)

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-8 lg:px-10">
      <PageHeader
        title="Components"
        description="Agent-native React components built on the shadcn registry."
      />
      {GROUPS.map((group) => {
        const groupItems = items.filter(
          (item) => item.agentUi?.status === group.status,
        )
        if (groupItems.length === 0) {
          return null
        }
        return (
          <section key={group.status} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {group.label}
              </h2>
              <p className="text-sm text-muted-foreground">{group.note}</p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {groupItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={`/components/${activeBase}/${item.name}`}
                    className="block px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{item.title}</span>
                      <code className="font-mono text-xs text-muted-foreground">
                        {item.name}
                      </code>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    {item.agentUi?.status === "agent-native" ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {/* Keyed by position, not by kind: one component may
                            declare several capabilities of the same kind — the
                            menubar reports two `select`s — and a duplicate key
                            makes React drop one of the badges. */}
                        {item.agentUi.capabilities.map((cap, index) => (
                          <KindBadge key={index} kind={cap.kind} />
                        ))}
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
