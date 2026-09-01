"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/duz-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

type PopoverState = {
  open: boolean
  disabled: boolean
}

type PopoverActions = {
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
interface PopoverTriggerContextValue {
  setTriggerLabel: (label: string | null) => void
  /**
   * The trigger attaches itself here. The root's own name lives in the
   * trigger's text, and the trigger is the part that stays mounted, so this
   * is what the root's id is derived from — read at registration, before the
   * reported label has made its way back through state.
   */
  nameRef: React.RefObject<HTMLElement | null>
}

const PopoverTriggerContext = React.createContext<PopoverTriggerContextValue | null>(null)

function usePopoverTriggerContext(): PopoverTriggerContextValue {
  const ctx = React.useContext(PopoverTriggerContext)
  if (!ctx) {
    throw new Error("PopoverTrigger must be rendered inside <Popover>.")
  }
  return ctx
}

function Popover({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root> & {
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

  const { id } = useCapability<PopoverState, PopoverActions>({
    agent,
    kind: "disclosure",
    defaultLabel: triggerLabel ?? "Popover",
    identitySource,
    read: () => ({ open, disabled: false }),
    actions: {
      open() {
        setOpen(true)
      },
      close() {
        setOpen(false)
      },
      toggle() {
        setOpen(!open)
      },
    },
  })

  const contextValue = React.useMemo<PopoverTriggerContextValue>(
    () => ({ setTriggerLabel: reportTriggerLabel, nameRef }),
    [reportTriggerLabel],
  )

  // The content mounts only while the popover is open; every capability it
  // registers belongs to the popover. When the popover opted out, `id` is
  // undefined and the provider passes `ownerId: undefined`, so descendants
  // stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <PopoverTriggerContext.Provider value={contextValue}>
        <PopoverPrimitive.Root
          data-slot="popover"
          open={open}
          onOpenChange={setOpen}
          {...props}
        />
      </PopoverTriggerContext.Provider>
    </AgentContainerProvider>
  )
}

function PopoverTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const { setTriggerLabel, nameRef } = usePopoverTriggerContext()
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
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
