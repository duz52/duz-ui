/**
 * avatar example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Avatar, AvatarFallback } from "@/components/radix/ui/avatar"

export function Preview(): React.JSX.Element {
  return (
    <div className="flex -space-x-2">
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AT</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>
    </div>
  )
}

export const usage = `<Avatar>
  <AvatarImage src={user.avatarUrl} alt={user.name} />
  <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
</Avatar>`
