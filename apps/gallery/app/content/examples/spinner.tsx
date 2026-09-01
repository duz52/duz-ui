/**
 * spinner example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { Spinner } from "@/components/radix/ui/spinner"

export function Preview(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      Loading orders…
    </div>
  )
}

export const usage = `<Spinner />`
