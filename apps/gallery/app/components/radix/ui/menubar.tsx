"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menubar as MenubarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { pressElement } from "@/lib/agent-ui/press"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectBoolean, expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * Menus only need to announce themselves. The open menu's value stays with
 * Radix, so nothing is duplicated into this context.
 */
interface MenubarMenuContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerMenu: (value: string) => () => void
  describeMenu: (value: string, label: string | undefined, disabled: boolean) => void
  /** The value of the currently open menu, or `null` when none is open. */
  openValue: string | null
  changeOpen: (value: string, open: boolean) => void
}

const MenubarMenuContext = React.createContext<MenubarMenuContextValue | null>(null)

function useMenubarMenuRegistry(): MenubarMenuContextValue {
  const ctx = React.useContext(MenubarMenuContext)
  if (!ctx) {
    throw new Error("MenubarMenu must be rendered inside <Menubar>.")
  }
  return ctx
}

/**
 * A menu's label is its trigger's text, so the trigger describes itself to
 * its menu and the menu folds that into what it announces to the root.
 */
interface MenubarTriggerContextValue {
  describeTrigger: (label: string | undefined, disabled: boolean) => void
}

const MenubarTriggerContext = React.createContext<MenubarTriggerContextValue | null>(null)

function useMenubarTriggerRegistry(): MenubarTriggerContextValue {
  const ctx = React.useContext(MenubarTriggerContext)
  if (!ctx) {
    throw new Error("MenubarTrigger must be rendered inside <MenubarMenu>.")
  }
  return ctx
}

type MenubarState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type MenubarActions = {
  choose: { value: string }
  clear: Record<string, never>
}

function Menubar({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  agent,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Root> & {
  agent?: AgentProp
}) {
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  })

  const [options, setOptions] = React.useState<OptionEntry[]>([])

  // Registration owns order, so it depends on the menu's value alone. Label
  // and disabled state are updated in place; removing and re-appending on a
  // `disabled` toggle would reorder what the agent reads.
  const registerMenu = React.useCallback((value: string): (() => void) => {
    setOptions((prev) =>
      prev.some((option) => option.value === value)
        ? prev
        : [...prev, { value, disabled: false }],
    )
    return () => {
      setOptions((prev) => prev.filter((option) => option.value !== value))
    }
  }, [])

  const describeMenu = React.useCallback(
    (value: string, label: string | undefined, disabled: boolean) => {
      setOptions((prev) => {
        const index = prev.findIndex((option) => option.value === value)
        const current = prev[index]
        if (!current) return prev
        if (current.label === label && current.disabled === disabled) return prev
        const next = [...prev]
        next[index] = { value, label, disabled }
        return next
      })
    },
    [],
  )

  // Radix derives every menu's open state from this root's single value, so
  // opening a named menu is one write into it. Closing a menu that is not the
  // open one is a no-op, so a stray close cannot take down the menu an agent
  // is looking at.
  const changeOpen = React.useCallback(
    (menuValue: string, open: boolean) => {
      if (!open && value !== menuValue) return
      setValue(open ? menuValue : "")
    },
    [setValue, value],
  )

  // Bound as one `select`, not a disclosure per menu. Radix derives every
  // menu's open state from this root's single value (`open` is
  // `context.value === value`, and closing writes "" back into the root), so
  // at most one menu can be open at any moment. That mutual exclusion is a
  // single choice over the menus — exactly a select — and it is invisible in
  // the markup: binding disclosures would promise an agent it could open two
  // menus at once, which the primitive cannot do.
  useCapability<MenubarState, MenubarActions>({
    agent,
    kind: "select",
    defaultLabel: "Menubar",
    read: () => ({
      value: value === "" ? null : value,
      options: options.map((o) => ({
        value: o.value,
        label: o.label,
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

  const contextValue = React.useMemo<MenubarMenuContextValue>(
    () => ({
      registerMenu,
      describeMenu,
      openValue: value === "" ? null : value,
      changeOpen,
    }),
    [registerMenu, describeMenu, value, changeOpen],
  )

  return (
    <MenubarMenuContext.Provider value={contextValue}>
      <MenubarPrimitive.Root
        data-slot="menubar"
        value={value}
        onValueChange={setValue}
        className={cn(
          "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
          className
        )}
        {...props}
      />
    </MenubarMenuContext.Provider>
  )
}

type MenubarMenuState = {
  open: boolean
  disabled: boolean
}

type MenubarMenuActions = {
  open: Record<string, never>
  close: Record<string, never>
  toggle: Record<string, never>
}

function MenubarMenu({
  value: menuValue,
  agent,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu> & {
  agent?: AgentProp
}) {
  const { registerMenu, describeMenu, openValue, changeOpen } = useMenubarMenuRegistry()
  const [trigger, setTrigger] = React.useState<{
    label: string | undefined
    disabled: boolean
  }>({ label: undefined, disabled: false })

  const describeTrigger = React.useCallback(
    (label: string | undefined, disabled: boolean) => {
      setTrigger((prev) =>
        prev.label === label && prev.disabled === disabled
          ? prev
          : { label, disabled },
      )
    },
    [],
  )

  // A menu without a `value` cannot be addressed by an agent, so it is not an
  // option: it is left out of the root's options rather than given an
  // invented value the application never chose. (Radix generates an internal
  // id for such menus; that id is not a name.)
  React.useEffect(() => {
    if (menuValue === undefined) return
    return registerMenu(menuValue)
  }, [registerMenu, menuValue])

  React.useEffect(() => {
    if (menuValue === undefined) return
    describeMenu(menuValue, trigger.label, trigger.disabled)
  }, [describeMenu, menuValue, trigger.label, trigger.disabled])

  const contextValue = React.useMemo<MenubarTriggerContextValue>(
    () => ({ describeTrigger }),
    [describeTrigger],
  )

  // A menu is a disclosure, exactly like a standalone DropdownMenu: it opens
  // and closes, and its items nest under it. A menu without a `value` cannot
  // be addressed by an agent — the same rule that keeps it out of the root's
  // options keeps it from registering: Radix derives its open state from the
  // root's value, which no action could set for a menu the menubar cannot
  // name.
  const { id } = useCapability<MenubarMenuState, MenubarMenuActions>({
    agent: menuValue === undefined ? false : agent,
    kind: "disclosure",
    defaultLabel: trigger.label ?? "Menu",
    read: () => ({ open: openValue === menuValue, disabled: false }),
    actions: {
      // The actions only run for a menu the menubar can name; a valueless
      // menu registers nothing (see `agent` above).
      open() {
        changeOpen(menuValue!, true)
      },
      close() {
        changeOpen(menuValue!, false)
      },
      toggle() {
        changeOpen(menuValue!, openValue !== menuValue)
      },
    },
  })

  // Every capability rendered inside the menu — its items — belongs to it.
  // When the menu registered nothing, `id` is undefined and the provider
  // passes `ownerId: undefined` through, so descendants stay roots.
  return (
    <MenubarTriggerContext.Provider value={contextValue}>
      <AgentContainerProvider ownerId={id}>
        <MenubarPrimitive.Menu data-slot="menubar-menu" value={menuValue} {...props} />
      </AgentContainerProvider>
    </MenubarTriggerContext.Provider>
  )
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />
}

/**
 * Items only need to announce themselves. The chosen value stays with Radix,
 * so nothing is duplicated into this context.
 */
interface MenubarRadioContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerOption: (value: string) => () => void
  describeOption: (value: string, label: string | undefined, disabled: boolean) => void
}

const MenubarRadioContext = React.createContext<MenubarRadioContextValue | null>(null)

function useMenubarRadioContext(): MenubarRadioContextValue {
  const ctx = React.useContext(MenubarRadioContext)
  if (!ctx) {
    throw new Error("MenubarRadioItem must be rendered inside <MenubarRadioGroup>.")
  }
  return ctx
}

type MenubarRadioGroupState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type MenubarRadioGroupActions = {
  choose: { value: string }
  clear: Record<string, never>
}

function MenubarRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup> & {
  defaultValue?: string
  agent?: AgentProp
}) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Menu options")
  const identitySource = useAccessibleNameResolver(groupRef)
  const mergedRef = useMergedRef(ref, groupRef)

  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  })

  const [options, setOptions] = React.useState<OptionEntry[]>([])

  // Registration owns order, so it depends on the option's value alone. Label
  // and disabled state are updated in place; removing and re-appending on a
  // `disabled` toggle would reorder what the agent reads.
  const registerOption = React.useCallback((value: string): (() => void) => {
    setOptions((prev) =>
      prev.some((option) => option.value === value)
        ? prev
        : [...prev, { value, disabled: false }],
    )
    return () => {
      setOptions((prev) => prev.filter((option) => option.value !== value))
    }
  }, [])

  const describeOption = React.useCallback(
    (value: string, label: string | undefined, disabled: boolean) => {
      setOptions((prev) => {
        const index = prev.findIndex((option) => option.value === value)
        const current = prev[index]
        if (!current) return prev
        if (current.label === label && current.disabled === disabled) return prev
        const next = [...prev]
        next[index] = { value, label, disabled }
        return next
      })
    },
    [],
  )

  useCapability<MenubarRadioGroupState, MenubarRadioGroupActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "select",
    defaultLabel: label,
    identitySource,
    read: () => ({
      value: value === "" ? null : value,
      options: options.map((o) => ({
        value: o.value,
        label: o.label,
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

  const contextValue = React.useMemo<MenubarRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <MenubarRadioContext.Provider value={contextValue}>
      <MenubarPrimitive.RadioGroup
        data-slot="menubar-radio-group"
        value={value}
        onValueChange={setValue}
        ref={mergedRef}
        {...props}
      />
    </MenubarRadioContext.Provider>
  )
}

function MenubarTrigger({
  className,
  disabled = false,
  ref,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Trigger>) {
  const { describeTrigger } = useMenubarTriggerRegistry()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const label = useAccessibleName(triggerRef, "")
  const mergedRef = useMergedRef(ref, triggerRef)

  // The menu's label is its trigger's text; no trigger text means no label.
  React.useEffect(() => {
    describeTrigger(label === "" ? undefined : label, disabled)
  }, [describeTrigger, label, disabled])

  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className
      )}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    />
  )
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </MenubarPortal>
  )
}

// MenubarItem has no state of its own to report beyond its name and whether
// it can be pressed at all — its meaning is the application's onSelect
// handler. It is a thing you press, and `kind: "button"` already exists and
// already carries a `button_press` tool, so modelling it as a new kind would
// multiply the protocol for no gain.
type MenubarItemState = {
  label: string
  disabled: boolean
}

type MenubarItemActions = {
  press: Record<string, never>
}

function MenubarItem({
  className,
  inset,
  variant = "default",
  ref,
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  useCapability<MenubarItemState, MenubarItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "button",
    defaultLabel: label,
    identitySource,
    read: () => ({ label, disabled }),
    actions: {
      press() {
        if (disabled) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        // A press, not a bare click: the full sequence a person makes.
        pressElement(elementRef.current!)
      },
    },
  })

  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      ref={mergedRef}
      {...props}
    />
  )
}

type MenubarCheckboxItemState = {
  checked: boolean
  disabled: boolean
}

type MenubarCheckboxItemActions = {
  set: { checked: boolean }
}

function MenubarCheckboxItem({
  className,
  children,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  ref,
  agent,
  ...props
}: Omit<React.ComponentProps<typeof MenubarPrimitive.CheckboxItem>, "checked"> & {
  checked?: boolean
  defaultChecked?: boolean
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Menu checkbox")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  const [checked, setChecked] = useControllableState<boolean>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  })

  useCapability<MenubarCheckboxItemState, MenubarCheckboxItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    identitySource,
    read: () => ({ checked, disabled }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Menubar menu checkbox is disabled and cannot be changed.")
        }
        setChecked(next)
      },
    },
  })

  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
}

function MenubarRadioItem({
  className,
  children,
  value,
  disabled = false,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioItem>) {
  const { registerOption, describeOption } = useMenubarRadioContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <MenubarPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

type MenubarSubTriggerState = {
  label: string
  disabled: boolean
}

type MenubarSubTriggerActions = {
  press: Record<string, never>
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ref,
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubTrigger> & {
  inset?: boolean
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // A sub-trigger opens a submenu rather than performing an action, but it is
  // still a thing you press: registering it as a button is what lets an agent
  // reach a nested menu at all. `kind: "button"` already exists and already
  // carries a `button_press` tool, so no new kind is needed.
  useCapability<MenubarSubTriggerState, MenubarSubTriggerActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "button",
    defaultLabel: label,
    identitySource,
    read: () => ({ label, disabled }),
    actions: {
      press() {
        if (disabled) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        pressElement(elementRef.current!)
      },
    },
  })

  return (
    <MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      disabled={disabled}
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" />
    </MenubarPrimitive.SubTrigger>
  )
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.SubContent
      data-slot="menubar-sub-content"
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  )
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
}
