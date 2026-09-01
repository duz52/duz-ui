/**
 * button example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"

export function Preview(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  )
}

export const usage = `// A button never becomes an agent action automatically.
// Wrap it in <AgentAction> to expose business semantics:
<AgentAction
  id="refresh-orders"
  description="Refresh the orders list."
  execute={refresh}
>
  <Button variant="outline">Refresh</Button>
</AgentAction>`
