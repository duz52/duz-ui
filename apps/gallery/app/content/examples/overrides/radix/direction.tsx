/**
 * Direction example for the radix tree — hand-written because the
 * bases' usage differs here: Radix's provider takes `dir`; Base UI's takes `direction`.
 */

import type * as React from "react"

import { DirectionProvider, useDirection } from "@/components/radix/ui/direction"

function DirectionLabel(): React.JSX.Element {
  const direction = useDirection()
  return (
    <p className="text-sm text-muted-foreground">
      Reading direction: {direction}
    </p>
  )
}

export function Preview(): React.JSX.Element {
  return (
    <DirectionProvider dir="rtl">
      <DirectionLabel />
    </DirectionProvider>
  )
}

export const usage = `<DirectionProvider dir="rtl">
  <App />
</DirectionProvider>`
