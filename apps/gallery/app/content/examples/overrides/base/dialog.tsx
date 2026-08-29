/**
 * Dialog example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import type * as React from "react"

import { Button } from "@/components/base/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/base/ui/dialog"

export function Preview(): React.JSX.Element {
  return (
    <Dialog agent={{ id: "preview-dialog", label: "Preview dialog" }}>
      <DialogTrigger render={<Button variant="outline" />}>
        Open dialog
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>
            This dialog is a fully agent-operable surface.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export const usage = `<Dialog agent={{ id: "confirm-dialog", label: "Confirm" }}>
  <DialogTrigger render={<Button variant="outline" />}>
    Open
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm action</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>`
