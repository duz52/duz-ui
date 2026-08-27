import { Link } from "react-router"
import type { Route } from "./+types/docs"
import { DOC_PAGES } from "@/content/docs"
import { PageHeader } from "@/components/site/page-header"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Docs — Agent UI" }]
}

export default function Docs() {
  return (
    <div className="py-8">
      <PageHeader
        title="Documentation"
        description="The engineering contract behind agent-operable React components."
      />
      <ol className="mt-8 space-y-2">
        {DOC_PAGES.map((page, index) => (
          <li key={page.slug}>
            <Link
              to={`/docs/${page.slug}`}
              className="flex items-baseline gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/30"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="space-y-1">
                <span className="block font-medium">{page.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {page.summary}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
