"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

/**
 * Base UI has no Anchor part — the Positioner takes the anchor element via
 * its `anchor` prop instead. PopoverAnchor registers its element here so
 * PopoverContent can hand it to the Positioner.
 */
interface PopoverContextValue {
  anchor: HTMLDivElement | null
  setAnchor: (element: HTMLDivElement | null) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverAnchorSetter(): (element: HTMLDivElement | null) => void {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) {
    throw new Error("PopoverAnchor must be rendered inside <Popover>.")
  }
  return ctx.setAnchor
}

type PopoverState = {
  open: boolean
  disabled: boolean
}

type PopoverActions = {
  open: Record<string, never>
  close: Record<string, never>
  toggle: Record<string, never>
}

function Popover({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: Omit<PopoverPrimitive.Root.Props, "onOpenChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
  agent?: AgentProp
}) {
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null)

  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  useCapability<PopoverState, PopoverActions>({
    agent,
    kind: "disclosure",
    defaultLabel: "Popover",
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

  const contextValue = React.useMemo<PopoverContextValue>(
    () => ({ anchor, setAnchor }),
    [anchor, setAnchor],
  )

  return (
    // The Base UI root renders no element, so it carries no data-slot.
    <PopoverContext.Provider value={contextValue}>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => setOpen(next)}
        {...props}
      />
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  ...props
}: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  side,
  align = "center",
  alignOffset,
  sideOffset = 4,
  collisionPadding,
  ...props
}: Omit<
  PopoverPrimitive.Popup.Props &
    Pick<
      PopoverPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    >,
  "className"
> & {
  className?: string
}) {
  const ctx = React.useContext(PopoverContext)

  return (
    <PopoverPrimitive.Portal>
      {/* A registered anchor wins over the default trigger anchoring; a null
          anchor falls back to the trigger. */}
      <PopoverPrimitive.Positioner
        anchor={ctx?.anchor ?? null}
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 origin-(--transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ref,
  ...props
}: React.ComponentProps<"div">) {
  const setAnchor = usePopoverAnchorSetter()
  const mergedRef = useMergedRef(ref, setAnchor)

  return <div ref={mergedRef} data-slot="popover-anchor" {...props} />
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
