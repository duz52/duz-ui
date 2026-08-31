"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

/**
 * The title reports itself so the capability can carry a human-meaningful
 * label. Open state stays with vaul, so nothing is duplicated here. The
 * trigger attaches itself through nameRef: the title lives in content that a
 * Portal renders and is unmounted while the drawer is closed, so the
 * always-mounted trigger is the part the root's id is derived from — read at
 * registration, before the reported title has made its way back through
 * state.
 */
interface DrawerContextValue {
  setTitle: React.Dispatch<React.SetStateAction<string | null>>
  nameRef: React.RefObject<HTMLElement | null>
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

function useDrawerContext(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext)
  if (!ctx) {
    throw new Error("DrawerTrigger and DrawerTitle must be rendered inside <Drawer>.")
  }
  return ctx
}

type DrawerState = {
  open: boolean
  title: string | null
}

type DrawerActions = {
  open: Record<string, never>
  close: Record<string, never>
}

function Drawer({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root> & {
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  const [title, setTitle] = React.useState<string | null>(null)
  const nameRef = React.useRef<HTMLElement | null>(null)
  const identitySource = useAccessibleNameResolver(nameRef)

  useCapability<DrawerState, DrawerActions>({
    agent,
    kind: "dialog",
    defaultLabel: title ?? "Drawer",
    identitySource,
    read: () => ({ open, title }),
    actions: {
      open() {
        setOpen(true)
      },
      close() {
        setOpen(false)
      },
    },
  })

  const contextValue = React.useMemo<DrawerContextValue>(
    () => ({ setTitle, nameRef }),
    [setTitle],
  )

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  const { nameRef } = useDrawerContext()
  // The trigger reports nothing: the title still owns the label. It only
  // attaches itself, so the root's id comes from the part that is always
  // mounted.
  const mergedRef = useMergedRef(ref, nameRef)
  return (
    <DrawerPrimitive.Trigger
      data-slot="drawer-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-background",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  const ctx = useDrawerContext()
  const { setTitle } = ctx
  const title = typeof children === "string" ? children : null

  React.useEffect(() => {
    setTitle(title)
    return () => {
      setTitle(null)
    }
  }, [setTitle, title])

  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </DrawerPrimitive.Title>
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
