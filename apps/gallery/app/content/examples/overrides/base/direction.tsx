/**
 * Direction example for the base tree — hand-written because the
 * bases' usage differs here: Base UI's provider takes `direction`; Radix's takes `dir`.
 */

import type * as React from "react"

import { DirectionProvider, useDirection } from "@/components/base/ui/direction"

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
    <DirectionProvider direction="rtl">
      <DirectionLabel />
    </DirectionProvider>
  )
}

export const usage = `<DirectionProvider direction="rtl">
  <App />
</DirectionProvider>`
