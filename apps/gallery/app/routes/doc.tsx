import { Link } from "react-router"
import type { Route } from "./+types/doc"
import { getDocPage, getDocNeighbours } from "@/content/docs"
import { PageHeader } from "@/components/site/page-header"
import { DocBody } from "@/components/site/doc-body"

export function meta({ params }: Route.MetaArgs) {
  const page = getDocPage(params.slug ?? "")
  return [{ title: page ? `${page.title} — Duz UI` : "Duz UI" }]
}

export function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug ?? ""
  const page = getDocPage(slug)
  if (!page) {
    throw new Response("Not Found", { status: 404 })
  }
  const neighbours = getDocNeighbours(slug)
  return { page, neighbours }
}

export default function Doc({ loaderData }: Route.ComponentProps) {
  const { page, neighbours } = loaderData
  return (
    // Prose gets a reading measure of its own. The shell is as wide as the
    // playground's two-column grid needs; a line of body text that long is
    // read by scanning back to the wrong line.
    <div className="mx-auto max-w-3xl py-8">
      <PageHeader title={page.title} description={page.summary} />
      <div className="mt-8">
        <DocBody blocks={page.body} />
      </div>
      <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
        {neighbours.prev ? (
          <Link
            to={`/docs/${neighbours.prev.slug}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {neighbours.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {neighbours.next ? (
          <Link
            to={`/docs/${neighbours.next.slug}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {neighbours.next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
