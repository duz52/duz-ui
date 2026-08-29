/**
 * progress example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Progress } from "@/components/radix/ui/progress"

export function Preview(): React.JSX.Element {
  return (
    <Progress
      value={66}
      className="max-w-xs"
      agent={{ id: "preview-progress", label: "Preview progress" }}
    />
  )
}

export const usage = `<Progress
  value={66}
  agent={{ id: "upload", label: "Upload" }}
/>`
