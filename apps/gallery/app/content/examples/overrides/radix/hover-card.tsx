/**
 * Hover card example for the radix tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Radix's `asChild` prop, which Base UI spells `render`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/radix/ui/hover-card"

export function Preview(): React.JSX.Element {
  return (
    <HoverCard agent={{ id: "preview-hover-card", label: "Preview hover card" }}>
      <HoverCardTrigger asChild>
        <Button variant="link">@agent-ui</Button>
      </HoverCardTrigger>
      <HoverCardContent className="space-y-1">
        <p className="text-sm font-medium">Agent UI</p>
        <p className="text-sm text-muted-foreground">
          Agent-native React components for real applications.
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

export const usage = `// A person opens this by hovering the trigger; an agent opens it
// explicitly with the "open" action.
<HoverCard agent={{ id: "profile-card", label: "Profile" }}>
  <HoverCardTrigger asChild>
    <Button variant="link">@agent-ui</Button>
  </HoverCardTrigger>
  <HoverCardContent>
    <p>…</p>
  </HoverCardContent>
</HoverCard>`
