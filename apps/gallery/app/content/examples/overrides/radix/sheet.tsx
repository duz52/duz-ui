/**
 * Sheet example for the radix tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Radix's `asChild` prop, which Base UI spells `render`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/radix/ui/sheet"

export function Preview(): React.JSX.Element {
  return (
    <Sheet agent={{ id: "preview-sheet", label: "Preview sheet" }}>
      <SheetTrigger asChild>
        <Button variant="outline">Open sheet</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Account settings</SheetTitle>
          <SheetDescription>
            Make changes to your account here.
          </SheetDescription>
        </SheetHeader>
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Profile, notifications and security live in this panel.
        </p>
      </SheetContent>
    </Sheet>
  )
}

export const usage = `<Sheet agent={{ id: "settings-sheet", label: "Settings" }}>
  <SheetTrigger asChild>
    <Button variant="outline">Open</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>…</SheetDescription>
    </SheetHeader>
    <p>…</p>
  </SheetContent>
</Sheet>`
