/**
 * Popover example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/base/ui/popover"

export function Preview(): React.JSX.Element {
  return (
    <Popover agent={{ id: "preview-popover", label: "Preview popover" }}>
      <PopoverTrigger render={<Button variant="outline" />}>
        Export options
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
  <PopoverTrigger render={<Button variant="outline" />}>
    Export
  </PopoverTrigger>
  <PopoverContent>
    <p>…</p>
  </PopoverContent>
</Popover>`
