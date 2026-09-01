/**
 * textarea example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { Label } from "@/components/radix/ui/label"
import { Textarea } from "@/components/radix/ui/textarea"

export function Preview(): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-textarea">Bio</Label>
      <Textarea
        id="preview-textarea"
        placeholder="Tell us about yourself"
        agent={{ id: "preview-textarea", label: "Preview textarea" }}
      />
    </div>
  )
}

export const usage = `<div className="space-y-1.5">
  <Label htmlFor="bio">Bio</Label>
  <Textarea
    id="bio"
    placeholder="Tell us about yourself"
    agent={{ id: "bio", label: "Bio" }}
  />
</div>`
