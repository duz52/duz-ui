/**
 * Collapsible example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/base/ui/collapsible"

export function Preview(): React.JSX.Element {
  return (
    <Collapsible agent={{ id: "preview-collapsible", label: "Preview collapsible" }}>
      <CollapsibleTrigger render={<Button variant="outline" />}>
        Show details
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-sm text-muted-foreground">
          These are the hidden details an agent can reveal.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}

export const usage = `<Collapsible agent={{ id: "details", label: "Details" }}>
  <CollapsibleTrigger render={<Button variant="outline" />}>
    Show details
  </CollapsibleTrigger>
  <CollapsibleContent>
    <p>…</p>
  </CollapsibleContent>
</Collapsible>`
