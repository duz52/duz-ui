/**
 * Tooltip example for the base tree — hand-written because the
 * bases' usage differs here: presentation only; its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/base/ui/tooltip"

export function Preview(): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover me
        </TooltipTrigger>
        <TooltipContent>Agent-native React components</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const usage = `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger render={<Button variant="outline" />}>
      Hover
    </TooltipTrigger>
    <TooltipContent>Saved to your workspace</TooltipContent>
  </Tooltip>
</TooltipProvider>`
