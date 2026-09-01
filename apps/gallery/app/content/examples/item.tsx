/**
 * item example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { FileTextIcon } from "lucide-react"

import { Badge } from "@/components/radix/ui/badge"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/radix/ui/item"

export function Preview(): React.JSX.Element {
  return (
    <Item variant="outline" className="max-w-sm">
      <ItemMedia variant="icon">
        <FileTextIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Quarterly report.pdf</ItemTitle>
        <ItemDescription>2.4 MB — updated 2 hours ago</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="outline">Shared</Badge>
      </ItemActions>
    </Item>
  )
}

export const usage = `<Item variant="outline">
  <ItemMedia variant="icon">
    <FileTextIcon />
  </ItemMedia>
  <ItemContent>
    <ItemTitle>Quarterly report.pdf</ItemTitle>
    <ItemDescription>2.4 MB — updated 2 hours ago</ItemDescription>
  </ItemContent>
</Item>`
