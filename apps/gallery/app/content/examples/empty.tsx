/**
 * empty example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { SearchIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/radix/ui/empty"

export function Preview(): React.JSX.Element {
  return (
    <Empty className="rounded-lg border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon />
        </EmptyMedia>
        <EmptyTitle>No results found</EmptyTitle>
        <EmptyDescription>
          Try a different search term or clear the filters.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export const usage = `<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <SearchIcon />
    </EmptyMedia>
    <EmptyTitle>No results found</EmptyTitle>
    <EmptyDescription>…</EmptyDescription>
  </EmptyHeader>
</Empty>`
