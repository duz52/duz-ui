/**
 * Popover example for the radix tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Radix's `asChild` prop, which Base UI spells `render`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/radix/ui/popover"

export function Preview(): React.JSX.Element {
  return (
    <Popover agent={{ id: "preview-popover", label: "Preview popover" }}>
      <PopoverTrigger asChild>
        <Button variant="outline">Export options</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm text-muted-foreground">
          The export includes comments and version history.
        </p>
      </PopoverContent>
    </Popover>
  )
}

export const usage = `<Popover agent={{ id: "export-options", label: "Export options" }}>
  <PopoverTrigger asChild>
    <Button variant="outline">Export</Button>
  </PopoverTrigger>
  <PopoverContent>
    <p>…</p>
  </PopoverContent>
</Popover>`
