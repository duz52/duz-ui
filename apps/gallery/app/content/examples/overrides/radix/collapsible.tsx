/**
 * Collapsible example for the radix tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Radix's `asChild` prop, which Base UI spells `render`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/radix/ui/collapsible"

export function Preview(): React.JSX.Element {
  return (
    <Collapsible agent={{ id: "preview-collapsible", label: "Preview collapsible" }}>
      <CollapsibleTrigger asChild>
        <Button variant="outline">Show details</Button>
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
  <CollapsibleTrigger asChild>
    <Button variant="outline">Show details</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <p>…</p>
  </CollapsibleContent>
</Collapsible>`
