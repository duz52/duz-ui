/**
 * input-group example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { SearchIcon } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/radix/ui/input-group"

export function Preview(): React.JSX.Element {
  return (
    <InputGroup className="max-w-xs">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search orders…" />
    </InputGroup>
  )
}

export const usage = `<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Search orders…" />
</InputGroup>`
