"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

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
}: Omit<CollapsiblePrimitive.Root.Props, "onOpenChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
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
      onOpenChange={(next) => setOpen(next)}
      disabled={disabled}
      {...props}
    />
  )
}

function CollapsibleTrigger({
  ...props
}: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
