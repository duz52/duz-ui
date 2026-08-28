"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectBoolean, expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * Menus announce themselves for the root's option list. The open menu's
 * value lives here too: Base UI's Menubar has no root value — each Menu
 * inside it owns its own open state — so the wrapper owns the single open
 * slot that Radix's root owns natively.
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
  disabled = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: Omit<MenubarPrimitive.Props, "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLDivElement>
  className?: string
  // Base UI's Menubar has no root value; the wrapper owns the open-menu
  // value that Radix's root owns natively. `null` is "no menu open" — the
  // empty sentinel Base UI already reports elsewhere.
  value?: string | null
  defaultValue?: string | null
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string | null) => void
  agent?: AgentProp
}) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
    onChange: onValueChange,
  })

  // Sibling menus open and close within one DOM event, before React commits,
  // so the close decision must read the latest intent rather than this
  // render's value: a menu closing must not clear a sibling that just opened.
  const valueRef = React.useRef(value)

  const changeValue = React.useCallback(
    (next: string | null) => {
      valueRef.current = next
      setValue(next)
    },
    [setValue],
  )

  // The application can also move the controlled value directly, without an
  // agent action or a menu event, so the ref mirrors every committed value.
  valueRef.current = value

  const changeOpen = React.useCallback(
    (menuValue: string, open: boolean) => {
      if (!open && valueRef.current !== menuValue) return
      changeValue(open ? menuValue : null)
    },
    [changeValue],
  )

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

  // Bound as one `select`, not a disclosure per menu. The wrapper derives
  // every menu's open state from this root's single value (`open` is
  // `openValue === value`, and closing writes `null` back), so at most one
  // menu can be open at any moment. That mutual exclusion is a single choice
  // over the menus — exactly a select — and it is invisible in the markup:
  // binding disclosures would promise an agent it could open two menus at
  // once, which the primitive cannot do.
  useCapability<MenubarState, MenubarActions>({
    agent,
    kind: "select",
    defaultLabel: "Menubar",
    read: () => ({
      value,
      options: options.map((o) => ({
        value: o.value,
        label: o.label,
        // The whole menubar can be disabled (Base UI's Menubar takes
        // `disabled`; Radix's root has no such concept), and a disabled
        // menubar disables every trigger inside, so the real state of an
        // option is the menu's own disabled state OR the menubar's.
        disabled: o.disabled || disabled,
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
        if (match.disabled || disabled) {
          rejectState(`Option "${next}" is disabled and cannot be selected.`)
        }
        changeValue(next)
      },
      clear() {
        changeValue(null)
      },
    },
  })

  const contextValue = React.useMemo<MenubarMenuContextValue>(
    () => ({ registerMenu, describeMenu, openValue: value, changeOpen }),
    [registerMenu, describeMenu, value, changeOpen],
  )

  return (
    <MenubarMenuContext.Provider value={contextValue}>
      <MenubarPrimitive
        ref={ref}
        data-slot="menubar"
        disabled={disabled}
        className={cn(
          "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
          className
        )}
        {...props}
      />
    </MenubarMenuContext.Provider>
  )
}

type MenubarMenuProps = Omit<MenuPrimitive.Root.Props, "onOpenChange"> & {
  /**
   * Identifies the menu to the menubar's capability. Menus without a value
   * cannot be addressed by an agent and stay out of the root's options.
   */
  value?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
}

function MenubarMenu({
  value: menuValue,
  disabled = false,
  onOpenChange,
  ...props
}: MenubarMenuProps) {
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
  // invented value the application never chose. Such a menu manages its own
  // open state, exactly as it would outside a menubar.
  React.useEffect(() => {
    if (menuValue === undefined) return
    return registerMenu(menuValue)
  }, [registerMenu, menuValue])

  React.useEffect(() => {
    if (menuValue === undefined) return
    describeMenu(menuValue, trigger.label, trigger.disabled || disabled)
  }, [describeMenu, menuValue, trigger.label, trigger.disabled, disabled])

  const contextValue = React.useMemo<MenubarTriggerContextValue>(
    () => ({ describeTrigger }),
    [describeTrigger],
  )

  // The Base UI menu root renders no element, so it carries no data-slot.
  if (menuValue === undefined) {
    return (
      <MenubarTriggerContext.Provider value={contextValue}>
        <MenuPrimitive.Root
          disabled={disabled}
          onOpenChange={(next) => onOpenChange?.(next)}
          {...props}
        />
      </MenubarTriggerContext.Provider>
    )
  }

  // The root's single value decides which menu is open, so the derived
  // `open` wins over anything the application passes — as Radix's menubar
  // derives it too.
  return (
    <MenubarTriggerContext.Provider value={contextValue}>
      <MenuPrimitive.Root
        {...props}
        disabled={disabled}
        open={openValue === menuValue}
        onOpenChange={(next) => {
          changeOpen(menuValue, next)
          onOpenChange?.(next)
        }}
      />
    </MenubarTriggerContext.Provider>
  )
}

function MenubarGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="menubar-group" {...props} />
}

function MenubarPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="menubar-portal" {...props} />
}

/**
 * Items only need to announce themselves. The chosen value stays with the
 * menu, so nothing is duplicated into this context.
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

// Base UI types the group value as `any`; pinning `string | null` keeps the
// capability contract enforceable, where `null` is "no selection" — the empty
// sentinel Base UI already reports, so the Radix twin's ""-to-null mapping has
// no counterpart here.
type MenubarRadioGroupProps = Omit<
  MenuPrimitive.RadioGroup.Props,
  "ref" | "value" | "defaultValue" | "onValueChange" | "className"
> & {
  value?: string
  defaultValue?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string | null) => void
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLDivElement>
  className?: string
  agent?: AgentProp
}

function MenubarRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  ref,
  agent,
  ...props
}: MenubarRadioGroupProps) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Menu options")
  const mergedRef = useMergedRef(ref, groupRef)

  // Base UI's empty sentinel is `null`, which is exactly what the agent reads.
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
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
    read: () => ({
      value,
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
        setValue(null)
      },
    },
  })

  const contextValue = React.useMemo<MenubarRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <MenubarRadioContext.Provider value={contextValue}>
      <MenuPrimitive.RadioGroup
        data-slot="menubar-radio-group"
        className={className}
        value={value}
        onValueChange={(next) => setValue(next)}
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
}: Omit<MenuPrimitive.Trigger.Props, "className" | "ref"> & {
  className?: string
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
}) {
  const { describeTrigger } = useMenubarTriggerRegistry()
  const triggerRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(triggerRef, "")
  const mergedRef = useMergedRef(ref, triggerRef)

  // The menu's label is its trigger's text; no trigger text means no label.
  React.useEffect(() => {
    describeTrigger(label === "" ? undefined : label, disabled)
  }, [describeTrigger, label, disabled])

  return (
    <MenuPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground",
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
  side,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  collisionPadding,
  ...props
}: Omit<
  MenuPrimitive.Popup.Props &
    Pick<
      MenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    >,
  "className"
> & {
  className?: string
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="menubar-content"
          className={cn(
            "z-50 min-w-[12rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

// MenubarItem has no agent capability. Its meaning is the application's
// onSelect handler, not the component's own state — exposing it would let an
// agent invoke arbitrary application logic the application never declared.
// Use AgentAction to declare an explicit agent action when needed.
function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: Omit<MenuPrimitive.Item.Props, "className"> & {
  className?: string
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
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
}: Omit<MenuPrimitive.CheckboxItem.Props, "ref" | "onCheckedChange" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onCheckedChange?: (checked: boolean) => void
  className?: string
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu checkbox")
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
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      onCheckedChange={(next) => setChecked(next)}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function MenubarRadioItem({
  className,
  children,
  value,
  disabled = false,
  ...props
}: Omit<MenuPrimitive.RadioItem.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  const { registerOption, describeOption } = useMenubarRadioContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function MenubarLabel({
  className,
  inset,
  ...props
}: Omit<MenuPrimitive.GroupLabel.Props, "className"> & {
  className?: string
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
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
}: Omit<MenuPrimitive.Separator.Props, "className"> & {
  className?: string
}) {
  return (
    <MenuPrimitive.Separator
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

function MenubarSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  // The Base UI submenu root renders no element, so it carries no data-slot.
  return <MenuPrimitive.SubmenuRoot {...props} />
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<MenuPrimitive.SubmenuTrigger.Props, "className"> & {
  className?: string
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-open:bg-accent data-open:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function MenubarSubContent({
  className,
  side,
  align,
  alignOffset,
  sideOffset,
  collisionPadding,
  ...props
}: Omit<
  MenuPrimitive.Popup.Props &
    Pick<
      MenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    >,
  "className"
> & {
  className?: string
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="menubar-sub-content"
          className={cn(
            "z-50 min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
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
