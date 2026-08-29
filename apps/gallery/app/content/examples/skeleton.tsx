/**
 * skeleton example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Skeleton } from "@/components/radix/ui/skeleton"

export function Preview(): React.JSX.Element {
  return (
    <div className="flex w-full max-w-xs items-center gap-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export const usage = `<div className="flex items-center gap-4">
  <Skeleton className="size-10 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>`
