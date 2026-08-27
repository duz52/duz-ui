"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"
import { rejectState } from "@/lib/agent-ui/validate"

type CollapsibleState = {
  open: boolean
  disabled: boolean
}

type CollapsibleActions = {
  open: Record<string, never>
  close: Record<string, never>
  toggle: Record<string, never>
}

function Collapsible({
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root> & {
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  useCapability<CollapsibleState, CollapsibleActions>({
    agent,
    kind: "disclosure",
    defaultLabel: "Collapsible",
    read: () => ({ open, disabled }),
    actions: {
      open() {
        if (disabled) {
          rejectState("Collapsible is disabled and cannot be changed.")
        }
        setOpen(true)
      },
      close() {
        if (disabled) {
          rejectState("Collapsible is disabled and cannot be changed.")
        }
        setOpen(false)
      },
      toggle() {
        if (disabled) {
          rejectState("Collapsible is disabled and cannot be changed.")
        }
        setOpen(!open)
      },
    },
  })

  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      {...props}
    />
  )
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
