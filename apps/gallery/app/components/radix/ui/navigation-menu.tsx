"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { ChevronDownIcon } from "lucide-react"
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectString, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

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
 * value stays with Radix, so nothing is duplicated into this context.
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

function NavigationMenu({
  className,
  children,
  viewport = true,
  value: valueProp,
  defaultValue,
  onValueChange,
  agent,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root> & {
  viewport?: boolean
  agent?: AgentProp
}) {
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
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

  // Bound as one `select`, not a disclosure per item. Radix derives every
  // item's open state from this root's single value (an item is open when
  // `context.value === item.value`, and closing writes "" back into the
  // root), so at most one item can be open at any moment. That mutual
  // exclusion is a single choice over the items — exactly a select — and it
  // is invisible in the markup: binding disclosures would promise an agent
  // it could open two items at once, which the primitive cannot do.
  useCapability<NavigationMenuState, NavigationMenuActions>({
    agent,
    kind: "select",
    defaultLabel: "Navigation menu",
    read: () => ({
      value: value === "" ? null : value,
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
        setValue("")
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
        data-viewport={viewport}
        value={value}
        onValueChange={setValue}
        className={cn(
          "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
          className
        )}
        {...props}
      >
        {children}
        {viewport && <NavigationMenuViewport />}
      </NavigationMenuPrimitive.Root>
    </NavigationMenuItemContext.Provider>
  )
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
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
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  const { registerItem, describeItem } = useNavigationMenuItemRegistry()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const readLabel = useAccessibleNameResolver(triggerRef)
  const [triggerDisabled, setTriggerDisabled] = React.useState(false)

  const describeTrigger = React.useCallback((disabled: boolean) => {
    setTriggerDisabled((prev) => (prev === disabled ? prev : disabled))
  }, [])

  // An item without a `value` cannot be addressed by an agent, so it is not
  // an option: it is left out of the root's options rather than given an
  // invented value the application never chose. (Radix generates an internal
  // id for such items; that id is not a name.)
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
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
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
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "top-0 left-0 w-full p-1 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-lg group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-foreground/10 group-data-[viewport=false]/navigation-menu:duration-300 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none md:absolute md:w-auto group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuViewport({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div
      className={cn(
        "absolute top-full left-0 isolate z-50 flex justify-center"
      )}
    >
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          "origin-top-center relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 duration-100 md:w-(--radix-navigation-menu-viewport-width) data-open:animate-in data-open:zoom-in-90 data-closed:animate-out data-closed:zoom-out-90",
          className
        )}
        {...props}
      />
    </div>
  )
}

function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
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
}: React.ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
        className
      )}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Indicator>
  )
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
}
