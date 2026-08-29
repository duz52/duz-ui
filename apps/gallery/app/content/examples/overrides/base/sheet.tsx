/**
 * Sheet example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/base/ui/sheet"

export function Preview(): React.JSX.Element {
  return (
    <Sheet agent={{ id: "preview-sheet", label: "Preview sheet" }}>
      <SheetTrigger render={<Button variant="outline" />}>
        Open sheet
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
  <SheetTrigger render={<Button variant="outline" />}>
    Open
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>…</SheetDescription>
    </SheetHeader>
    <p>…</p>
  </SheetContent>
</Sheet>`
