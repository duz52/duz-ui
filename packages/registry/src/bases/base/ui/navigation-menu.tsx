"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { ChevronDownIcon } from "lucide-react"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  /**
   * Resolved when an agent reads, not when the trigger renders. The name
   * lived two components below the root and reached it through two pieces of
   * state, so an option was published before its label existed and changed
   * under anything that had already read it. Reads are pull-based: by the
   * time this runs the trigger is mounted and its name is simply there.
   */
  readLabel: () => string | undefined
  disabled: boolean
}

/**
 * Items announce themselves for the root's option list. The open item's
 * value stays with Base UI, so nothing is duplicated into this context.
 */
interface NavigationMenuItemContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerItem: (value: string, readLabel: () => string | undefined) => () => void
  describeItem: (value: string, disabled: boolean) => void
}

const NavigationMenuItemContext = React.createContext<NavigationMenuItemContextValue | null>(null)

function useNavigationMenuItemRegistry(): NavigationMenuItemContextValue {
  const ctx = React.useContext(NavigationMenuItemContext)
  if (!ctx) {
    throw new Error("NavigationMenuItem must be rendered inside <NavigationMenu>.")
  }
  return ctx
}

/**
 * An item's label is its trigger's text, so the trigger describes itself to
 * its item and the item folds that into what it announces to the root.
 */
interface NavigationMenuTriggerContextValue {
  /** Filled by the trigger, read by the item's name resolver. */
  triggerRef: React.RefObject<HTMLButtonElement | null>
  describeTrigger: (disabled: boolean) => void
}

const NavigationMenuTriggerContext = React.createContext<NavigationMenuTriggerContextValue | null>(null)

function useNavigationMenuTriggerRegistry(): NavigationMenuTriggerContextValue {
  const ctx = React.useContext(NavigationMenuTriggerContext)
  if (!ctx) {
    throw new Error("NavigationMenuTrigger must be rendered inside <NavigationMenuItem>.")
  }
  return ctx
}

type NavigationMenuState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type NavigationMenuActions = {
  choose: { value: string }
  clear: Record<string, never>
}

// Pinning the generic to `string` keeps the capability contract enforceable:
// the root's `value` stays `string | null`, where `null` is "no item open".
type NavigationMenuProps = Omit<
  NavigationMenuPrimitive.Root.Props<string>,
  "onValueChange" | "className"
> & {
  className?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string | null) => void
  agent?: AgentProp
}

function NavigationMenu({
  align = "start",
  className,
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  agent,
  ...props
}: NavigationMenuProps &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  // Base UI's empty sentinel is `null`, which is exactly what the agent reads.
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
    onChange: onValueChange,
  })

  const [options, setOptions] = React.useState<OptionEntry[]>([])

  // Registration owns order, so it depends on the item's value alone. Label
  // and disabled state are updated in place; removing and re-appending on a
  // `disabled` toggle would reorder what the agent reads.
  const registerItem = React.useCallback(
    (value: string, readLabel: () => string | undefined): (() => void) => {
      setOptions((prev) =>
        prev.some((option) => option.value === value)
          ? prev
          : [...prev, { value, readLabel, disabled: false }],
      )
      return () => {
        setOptions((prev) => prev.filter((option) => option.value !== value))
      }
    },
    [],
  )

  const describeItem = React.useCallback((value: string, disabled: boolean) => {
    setOptions((prev) => {
      const index = prev.findIndex((option) => option.value === value)
      const current = prev[index]
      if (!current) return prev
      if (current.disabled === disabled) return prev
      const next = [...prev]
      next[index] = { ...current, disabled }
      return next
    })
  }, [])

  // Bound as one `select`, not a disclosure per item. Base UI derives every
  // item's open state from this root's single value (`value` is the item that
  // should be open, and closing writes `null` back), so at most one item can
  // be open at any moment. That mutual exclusion is a single choice over the
  // items — exactly a select — and it is invisible in the markup: binding
  // disclosures would promise an agent it could open two items at once,
  // which the primitive cannot do.
  useCapability<NavigationMenuState, NavigationMenuActions>({
    agent,
    kind: "select",
    defaultLabel: "Navigation menu",
    read: () => ({
      value,
      options: options.map((o) => ({
        value: o.value,
        label: o.readLabel(),
        disabled: o.disabled,
      })),
    }),
    actions: {
      choose(input) {
        const next = expectString(input, "value")
        const match = options.find((o) => o.value === next)
        if (!match) {
          const known = options.map((o) => o.value)
          rejectState(
            `Option "${next}" is not available. Available options: ${known.length ? known.join(", ") : "(none)"}.`,
          )
        }
        if (match.disabled) {
          rejectState(`Option "${next}" is disabled and cannot be selected.`)
        }
        setValue(next)
      },
      clear() {
        setValue(null)
      },
    },
  })

  const contextValue = React.useMemo<NavigationMenuItemContextValue>(
    () => ({ registerItem, describeItem }),
    [registerItem, describeItem],
  )

  return (
    <NavigationMenuItemContext.Provider value={contextValue}>
      <NavigationMenuPrimitive.Root
        data-slot="navigation-menu"
        value={value}
        onValueChange={(next) => setValue(next)}
        className={cn(
          "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
          className
        )}
        {...props}
      >
        {children}
        <NavigationMenuPositioner align={align} />
      </NavigationMenuPrimitive.Root>
    </NavigationMenuItemContext.Provider>
  )
}

function NavigationMenuList({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>, "className"> & {
  className?: string
}) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-0",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuItem({
  value,
  ...props
}: Omit<React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>, "value"> & {
  value?: string
}) {
  const { registerItem, describeItem } = useNavigationMenuItemRegistry()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const readLabel = useAccessibleNameResolver(triggerRef)
  const [triggerDisabled, setTriggerDisabled] = React.useState(false)

  const describeTrigger = React.useCallback((disabled: boolean) => {
    setTriggerDisabled((prev) => (prev === disabled ? prev : disabled))
  }, [])

  // An item without a `value` cannot be addressed by an agent, so it is not
  // an option: it is left out of the root's options rather than given an
  // invented value the application never chose. (Base UI generates an
  // internal id for such items; that id is not a name.) Such an item manages
  // its own open state, exactly as it would outside a navigation menu.
  React.useEffect(() => {
    if (value === undefined) return
    return registerItem(value, readLabel)
  }, [registerItem, value, readLabel])

  React.useEffect(() => {
    if (value === undefined) return
    describeItem(value, triggerDisabled)
  }, [describeItem, value, triggerDisabled])

  const contextValue = React.useMemo<NavigationMenuTriggerContextValue>(
    () => ({ triggerRef, describeTrigger }),
    [describeTrigger],
  )

  return (
    <NavigationMenuTriggerContext.Provider value={contextValue}>
      <NavigationMenuPrimitive.Item
        data-slot="navigation-menu-item"
        value={value}
        {...props}
      />
    </NavigationMenuTriggerContext.Provider>
  )
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted"
)

function NavigationMenuTrigger({
  className,
  children,
  disabled = false,
  ref,
  ...props
}: Omit<NavigationMenuPrimitive.Trigger.Props, "className"> & {
  className?: string
}) {
  const { triggerRef, describeTrigger } = useNavigationMenuTriggerRegistry()
  const mergedRef = useMergedRef(ref, triggerRef)

  // The item resolves the label off this element; only `disabled` is a fact
  // the item cannot see for itself.
  React.useEffect(() => {
    describeTrigger(disabled)
  }, [describeTrigger, disabled])

  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon className="relative top-px ml-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180 group-data-open/navigation-menu-trigger:rotate-180" aria-hidden="true" />
    </NavigationMenuPrimitive.Trigger>
  )
}

function NavigationMenuContent({
  className,
  ...props
}: Omit<NavigationMenuPrimitive.Content.Props, "className"> & {
  className?: string
}) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%] h-full w-auto p-1 transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[viewport=false]/navigation-menu:rounded-lg group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-foreground/10 group-data-[viewport=false]/navigation-menu:duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: Omit<NavigationMenuPrimitive.Positioner.Props, "className"> & {
  className?: string
}) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0",
          className
        )}
        {...props}
      >
        <NavigationMenuPrimitive.Popup className="data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0">
          <NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  )
}

function NavigationMenuLink({
  className,
  ...props
}: Omit<NavigationMenuPrimitive.Link.Props, "className"> & {
  className?: string
}) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuIndicator({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Icon>, "className"> & {
  className?: string
}) {
  return (
    <NavigationMenuPrimitive.Icon
      data-slot="navigation-menu-indicator"
      className={cn(
        "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
        className
      )}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Icon>
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuPositioner,
}
