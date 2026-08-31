"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

/**
 * The title reports itself so the capability can carry a human-meaningful
 * label. Open state stays with the drawer primitive, so nothing is duplicated
 * here. The trigger attaches itself through nameRef: the title lives in
 * content that a Portal renders and is unmounted while the drawer is closed,
 * so the always-mounted trigger is the part the root's id is derived from —
 * read at registration, before the reported title has made its way back
 * through state.
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
}: Omit<DrawerPrimitive.Root.Props, "onOpenChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
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
    [open, setOpen],
  )

  return (
    // The Base UI root renders no element, so it carries no data-slot.
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        open={open}
        onOpenChange={(next) => setOpen(next)}
        {...props}
      />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({
  ref,
  ...props
}: Omit<DrawerPrimitive.Trigger.Props, "ref"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
}) {
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
}: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: Omit<DrawerPrimitive.Backdrop.Props, "className"> & {
  className?: string
}) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/* A part Base UI's drawer genuinely provides and vaul's does not, so this
   export exists only on this base (see the base-to-base divergence table in
   internal/reference/base-ui.md). */
function DrawerSwipeHandle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={cn(
        "mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[swipe-direction=down]/drawer-content:block",
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
}: Omit<DrawerPrimitive.Popup.Props, "className"> & {
  className?: string
}) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      {/* The viewport lets outside presses reach the backdrop — modal
          dismissal targets the backdrop element itself — so it never captures
          pointer events; the popup opts back in. Touch swiping is handled by
          the viewport's document-level listeners and keeps working. */}
      <DrawerPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            // vaul animates its panel natively; Base UI's popup is unstyled,
            // so the slide in/out comes from these classes.
            "group/drawer-content pointer-events-auto fixed z-50 flex h-auto flex-col bg-background outline-none transition ease-in-out data-closed:animate-out data-closed:duration-300 data-open:animate-in data-open:duration-500",
            "data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:mb-24 data-[swipe-direction=up]:max-h-[80vh] data-[swipe-direction=up]:rounded-b-lg data-[swipe-direction=up]:border-b data-[swipe-direction=up]:data-closed:slide-out-to-top data-[swipe-direction=up]:data-open:slide-in-from-top",
            "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:mt-24 data-[swipe-direction=down]:max-h-[80vh] data-[swipe-direction=down]:rounded-t-lg data-[swipe-direction=down]:border-t data-[swipe-direction=down]:data-closed:slide-out-to-bottom data-[swipe-direction=down]:data-open:slide-in-from-bottom",
            "data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:w-3/4 data-[swipe-direction=right]:border-l data-[swipe-direction=right]:sm:max-w-sm data-[swipe-direction=right]:data-closed:slide-out-to-right data-[swipe-direction=right]:data-open:slide-in-from-right",
            "data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-3/4 data-[swipe-direction=left]:border-r data-[swipe-direction=left]:sm:max-w-sm data-[swipe-direction=left]:data-closed:slide-out-to-left data-[swipe-direction=left]:data-open:slide-in-from-left",
            className
          )}
          {...props}
        >
          <DrawerSwipeHandle />
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-left",
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
}: Omit<DrawerPrimitive.Title.Props, "className"> & {
  className?: string
}) {
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
}: Omit<DrawerPrimitive.Description.Props, "className"> & {
  className?: string
}) {
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
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
