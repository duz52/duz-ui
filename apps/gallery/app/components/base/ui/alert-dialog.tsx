"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/base/ui/button"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

/**
 * The title reports itself so the capability can carry a human-meaningful
 * label. Open state is owned by the AlertDialog wrapper, so nothing is
 * duplicated into this context. The trigger attaches itself through nameRef:
 * the title lives in content that a Portal renders and is unmounted while
 * the alert dialog is closed, so the always-mounted trigger is the part the
 * root's id is derived from — read at registration, before the reported
 * title has made its way back through state.
 */
interface AlertDialogContextValue {
  setTitle: React.Dispatch<React.SetStateAction<string | null>>
  nameRef: React.RefObject<HTMLElement | null>
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
  null,
)

function useAlertDialogContext(): AlertDialogContextValue {
  const ctx = React.useContext(AlertDialogContext)
  if (!ctx) {
    throw new Error(
      "AlertDialogTrigger and AlertDialogTitle must be rendered inside <AlertDialog>.",
    )
  }
  return ctx
}

type AlertDialogState = {
  open: boolean
  title: string | null
}

type AlertDialogActions = {
  open: Record<string, never>
  close: Record<string, never>
}

function AlertDialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: Omit<AlertDialogPrimitive.Root.Props, "onOpenChange"> & {
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

  const { id } = useCapability<AlertDialogState, AlertDialogActions>({
    agent,
    kind: "dialog",
    defaultLabel: title ?? "Alert dialog",
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

  const contextValue = React.useMemo<AlertDialogContextValue>(
    () => ({ setTitle, nameRef }),
    [open, setOpen],
  )

  // The content mounts only while the alert dialog is open; every
  // capability it registers belongs to the alert dialog. When the alert
  // dialog opted out, `id` is undefined and the provider passes
  // `ownerId: undefined`, so descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      {/* The Base UI root renders no element, so it carries no data-slot. */}
      <AlertDialogContext.Provider value={contextValue}>
        <AlertDialogPrimitive.Root
          open={open}
          onOpenChange={(next) => setOpen(next)}
          {...props}
        />
      </AlertDialogContext.Provider>
    </AgentContainerProvider>
  )
}

function AlertDialogTrigger({
  ref,
  ...props
}: Omit<AlertDialogPrimitive.Trigger.Props, "ref"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
}) {
  const { nameRef } = useAlertDialogContext()
  // The trigger reports nothing: the title still owns the label. It only
  // attaches itself, so the root's id comes from the part that is always
  // mounted.
  const mergedRef = useMergedRef(ref, nameRef)
  return (
    <AlertDialogPrimitive.Trigger
      data-slot="alert-dialog-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function AlertDialogPortal({
  ...props
}: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: Omit<AlertDialogPrimitive.Backdrop.Props, "className"> & {
  className?: string
}) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: Omit<AlertDialogPrimitive.Popup.Props, "className"> & {
  className?: string
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[size=default]:sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  children,
  ...props
}: Omit<AlertDialogPrimitive.Title.Props, "className"> & {
  className?: string
}) {
  const ctx = useAlertDialogContext()
  const { setTitle } = ctx
  const title = typeof children === "string" ? children : null

  React.useEffect(() => {
    setTitle(title)
    return () => {
      setTitle(null)
    }
  }, [setTitle, title])

  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Title>
  )
}

function AlertDialogDescription({
  className,
  ...props
}: Omit<AlertDialogPrimitive.Description.Props, "className"> & {
  className?: string
}) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

// AlertDialogAction and AlertDialogCancel confirm or dismiss a consequence
// whose meaning cannot be inferred from markup, so they stay ordinary
// components and are deliberately not exposed as agent actions.
// Base UI has no dedicated Action/Cancel parts — its Close carries the same
// "press to dismiss the dialog" behaviour for both.
function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={<Button variant={variant} size={size} />}
      className={className}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant={variant} size={size} />}
      className={className}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
