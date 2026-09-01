/**
 * Hover card example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/base/ui/hover-card"

export function Preview(): React.JSX.Element {
  return (
    <HoverCard agent={{ id: "preview-hover-card", label: "Preview hover card" }}>
      <HoverCardTrigger render={<Button variant="link" />}>
        @duz-ui
      </HoverCardTrigger>
      <HoverCardContent className="space-y-1">
        <p className="text-sm font-medium">Duz UI</p>
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
  <HoverCardTrigger render={<Button variant="link" />}>
    @duz-ui
  </HoverCardTrigger>
  <HoverCardContent>
    <p>…</p>
  </HoverCardContent>
</HoverCard>`
