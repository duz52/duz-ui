"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

/**
 * The title reports itself so the capability can carry a human-meaningful
 * label. Open state is owned by the Sheet wrapper, so nothing is duplicated
 * into this context. The trigger attaches itself through nameRef: the title
 * lives in content that a Portal renders and is unmounted while the sheet
 * is closed, so the always-mounted trigger is the part the root's id is
 * derived from — read at registration, before the reported title has made
 * its way back through state.
 */
interface SheetContextValue {
  setTitle: React.Dispatch<React.SetStateAction<string | null>>
  nameRef: React.RefObject<HTMLElement | null>
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheetContext(): SheetContextValue {
  const ctx = React.useContext(SheetContext)
  if (!ctx) {
    throw new Error("SheetTrigger and SheetTitle must be rendered inside <Sheet>.")
  }
  return ctx
}

type SheetState = {
  open: boolean
  title: string | null
}

type SheetActions = {
  open: Record<string, never>
  close: Record<string, never>
}

function Sheet({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: Omit<SheetPrimitive.Root.Props, "onOpenChange"> & {
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

  const { id } = useCapability<SheetState, SheetActions>({
    agent,
    kind: "dialog",
    defaultLabel: title ?? "Sheet",
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

  const contextValue = React.useMemo<SheetContextValue>(
    () => ({ setTitle, nameRef }),
    [open, setOpen],
  )

  // The content mounts only while the sheet is open; every capability it
  // registers belongs to the sheet. When the sheet opted out, `id` is
  // undefined and the provider passes `ownerId: undefined`, so descendants
  // stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      {/* The Base UI root renders no element, so it carries no data-slot. */}
      <SheetContext.Provider value={contextValue}>
        <SheetPrimitive.Root
          open={open}
          onOpenChange={(next) => setOpen(next)}
          {...props}
        />
      </SheetContext.Provider>
    </AgentContainerProvider>
  )
}

function SheetTrigger({
  ref,
  ...props
}: Omit<SheetPrimitive.Trigger.Props, "ref"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
}) {
  const { nameRef } = useSheetContext()
  // The trigger reports nothing: the title still owns the label. It only
  // attaches itself, so the root's id comes from the part that is always
  // mounted.
  const mergedRef = useMergedRef(ref, nameRef)
  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function SheetClose({
  ...props
}: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: Omit<SheetPrimitive.Backdrop.Props, "className"> & {
  className?: string
}) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: Omit<SheetPrimitive.Popup.Props, "className"> & {
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-closed:animate-out data-closed:duration-300 data-open:animate-in data-open:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-closed:slide-out-to-right data-open:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-closed:slide-out-to-left data-open:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-closed:slide-out-to-top data-open:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-closed:slide-out-to-bottom data-open:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-open:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  children,
  ...props
}: Omit<SheetPrimitive.Title.Props, "className"> & {
  className?: string
}) {
  const ctx = useSheetContext()
  const { setTitle } = ctx
  const title = typeof children === "string" ? children : null

  React.useEffect(() => {
    setTitle(title)
    return () => {
      setTitle(null)
    }
  }, [setTitle, title])

  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </SheetPrimitive.Title>
  )
}

function SheetDescription({
  className,
  ...props
}: Omit<SheetPrimitive.Description.Props, "className"> & {
  className?: string
}) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
