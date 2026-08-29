/**
 * Dialog example for the radix tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Radix's `asChild` prop, which Base UI spells `render`.
 */

import type * as React from "react"

import { Button } from "@/components/radix/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/radix/ui/dialog"

export function Preview(): React.JSX.Element {
  return (
    <Dialog agent={{ id: "preview-dialog", label: "Preview dialog" }}>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
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
  <DialogTrigger asChild>
    <Button variant="outline">Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm action</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>`
