/**
 * label example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { Label } from "@/components/radix/ui/label"

export function Preview(): React.JSX.Element {
  return (
    <Label htmlFor="label-demo">Form label</Label>
  )
}

export const usage = `<Label htmlFor="email">Email</Label>`
