"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
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

/**
 * The root renders no DOM element of its own and the content is unmounted
 * while closed, so the trigger is the only part that is always mounted and
 * always carries the human-meaningful name. It resolves its own accessible
 * name and reports it here; the root uses it as the capability's default
 * label.
 */
interface CollapsibleTriggerContextValue {
  setTriggerLabel: (label: string | null) => void
  /**
   * The trigger attaches itself here. The root's own name lives in the
   * trigger's text, and the trigger is the part that stays mounted, so this is
   * what the root's id is derived from — read at registration, before the
   * reported label has made its way back through state.
   */
  nameRef: React.RefObject<HTMLElement | null>
}

const CollapsibleTriggerContext = React.createContext<CollapsibleTriggerContextValue | null>(null)

function useCollapsibleTriggerContext(): CollapsibleTriggerContextValue {
  const ctx = React.useContext(CollapsibleTriggerContext)
  if (!ctx) {
    throw new Error("CollapsibleTrigger must be rendered inside <Collapsible>.")
  }
  return ctx
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

  const [triggerLabel, setTriggerLabel] = React.useState<string | null>(null)
  const nameRef = React.useRef<HTMLElement | null>(null)
  const identitySource = useAccessibleNameResolver(nameRef)

  // Ignore a label the root already holds, so a repeated report cannot loop.
  const reportTriggerLabel = React.useCallback((label: string | null) => {
    setTriggerLabel((prev) => (prev === label ? prev : label))
  }, [])

  const { id } = useCapability<CollapsibleState, CollapsibleActions>({
    agent,
    kind: "disclosure",
    defaultLabel: triggerLabel ?? "Collapsible",
    identitySource,
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

  const contextValue = React.useMemo<CollapsibleTriggerContextValue>(
    () => ({ setTriggerLabel: reportTriggerLabel, nameRef }),
    [reportTriggerLabel],
  )

  // The content mounts only while the collapsible is open; every
  // capability it registers belongs to the collapsible. When the
  // collapsible opted out, `id` is undefined and the provider passes
  // `ownerId: undefined`, so descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <CollapsibleTriggerContext.Provider value={contextValue}>
        <CollapsiblePrimitive.Root
          data-slot="collapsible"
          open={open}
          onOpenChange={(next) => setOpen(next)}
          disabled={disabled}
          {...props}
        />
      </CollapsibleTriggerContext.Provider>
    </AgentContainerProvider>
  )
}

function CollapsibleTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  const { setTriggerLabel, nameRef } = useCollapsibleTriggerContext()
  const elementRef = React.useRef<HTMLButtonElement>(null)
  // An empty resolution means the trigger carries no name; reporting null
  // lets the root keep its generic default.
  const label = useAccessibleName(elementRef, "")
  const mergedRef = useMergedRef(ref, elementRef, nameRef)

  // Reported in an effect: the name exists only once the element is mounted.
  React.useEffect(() => {
    setTriggerLabel(label === "" ? null : label)
  }, [setTriggerLabel, label])

  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      ref={mergedRef}
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
