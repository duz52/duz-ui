"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectBoolean, expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

type DropdownMenuState = {
  open: boolean
  disabled: boolean
}

type DropdownMenuActions = {
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
interface DropdownMenuTriggerContextValue {
  setTriggerLabel: (label: string | null) => void
}

const DropdownMenuTriggerContext = React.createContext<DropdownMenuTriggerContextValue | null>(null)

function useDropdownMenuTriggerLabelSetter(): (label: string | null) => void {
  const ctx = React.useContext(DropdownMenuTriggerContext)
  if (!ctx) {
    throw new Error("DropdownMenuTrigger must be rendered inside <DropdownMenu>.")
  }
  return ctx.setTriggerLabel
}

function DropdownMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled = false,
  agent,
  ...props
}: Omit<MenuPrimitive.Root.Props, "onOpenChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  const [triggerLabel, setTriggerLabel] = React.useState<string | null>(null)

  // Ignore a label the root already holds, so a repeated report cannot loop.
  const reportTriggerLabel = React.useCallback((label: string | null) => {
    setTriggerLabel((prev) => (prev === label ? prev : label))
  }, [])

  const { id } = useCapability<DropdownMenuState, DropdownMenuActions>({
    agent,
    kind: "disclosure",
    defaultLabel: triggerLabel ?? "Dropdown menu",
    read: () => ({ open, disabled }),
    actions: {
      open() {
        if (disabled) {
          rejectState("Dropdown menu is disabled and cannot be changed.")
        }
        setOpen(true)
      },
      close() {
        if (disabled) {
          rejectState("Dropdown menu is disabled and cannot be changed.")
        }
        setOpen(false)
      },
      toggle() {
        if (disabled) {
          rejectState("Dropdown menu is disabled and cannot be changed.")
        }
        setOpen(!open)
      },
    },
  })

  const contextValue = React.useMemo<DropdownMenuTriggerContextValue>(
    () => ({ setTriggerLabel: reportTriggerLabel }),
    [reportTriggerLabel],
  )

  return (
    // The Base UI root renders no element, so it carries no data-slot.
    // Every capability rendered inside the menu — its items — belongs to it.
    // When the menu opted out, `id` is undefined and the provider passes
    // `ownerId: undefined` through, so descendants stay roots.
    <DropdownMenuTriggerContext.Provider value={contextValue}>
      <AgentContainerProvider ownerId={id}>
        <MenuPrimitive.Root
          open={open}
          onOpenChange={(next) => setOpen(next)}
          disabled={disabled}
          {...props}
        />
      </AgentContainerProvider>
    </DropdownMenuTriggerContext.Provider>
  )
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return (
    <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ref,
  ...props
}: Omit<MenuPrimitive.Trigger.Props, "ref"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
}) {
  const setTriggerLabel = useDropdownMenuTriggerLabelSetter()
  const elementRef = React.useRef<HTMLElement>(null)
  // An empty resolution means the trigger carries no name; reporting null
  // lets the root keep its generic default.
  const label = useAccessibleName(elementRef, "")
  const mergedRef = useMergedRef(ref, elementRef)

  // Reported in an effect: the name exists only once the element is mounted.
  React.useEffect(() => {
    setTriggerLabel(label === "" ? null : label)
  }, [setTriggerLabel, label])

  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  side,
  align,
  alignOffset,
  sideOffset = 4,
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
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return (
    <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

type DropdownMenuItemState = {
  label: string
  disabled: boolean
}

type DropdownMenuItemActions = {
  press: Record<string, never>
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ref,
  disabled = false,
  agent,
  ...props
}: Omit<MenuPrimitive.Item.Props, "ref" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  className?: string
  inset?: boolean
  variant?: "default" | "destructive"
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const mergedRef = useMergedRef(ref, elementRef)

  // A menu item is a thing you press. `kind: "button"` already exists and
  // already carries a `button_press` tool, so modelling the item as a new
  // kind would multiply the protocol for no gain.
  useCapability<DropdownMenuItemState, DropdownMenuItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "button",
    defaultLabel: label,
    read: () => ({ label, disabled }),
    actions: {
      press() {
        if (disabled) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        // A click is what a person does: it runs the item's onClick and
        // whatever handlers the menu itself attaches to the element.
        elementRef.current?.click()
      },
    },
  })

  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      disabled={disabled}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      ref={mergedRef}
      {...props}
    />
  )
}

type DropdownMenuCheckboxItemState = {
  checked: boolean
  disabled: boolean
}

type DropdownMenuCheckboxItemActions = {
  set: { checked: boolean }
}

function DropdownMenuCheckboxItem({
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

  useCapability<DropdownMenuCheckboxItemState, DropdownMenuCheckboxItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    read: () => ({ checked, disabled }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Dropdown menu checkbox is disabled and cannot be changed.")
        }
        setChecked(next)
      },
    },
  })

  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * Items only need to announce themselves. The chosen value stays with the
 * menu, so nothing is duplicated into this context.
 */
interface DropdownMenuRadioContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerOption: (value: string) => () => void
  describeOption: (value: string, label: string | undefined, disabled: boolean) => void
}

const DropdownMenuRadioContext = React.createContext<DropdownMenuRadioContextValue | null>(null)

function useDropdownMenuRadioContext(): DropdownMenuRadioContextValue {
  const ctx = React.useContext(DropdownMenuRadioContext)
  if (!ctx) {
    throw new Error("DropdownMenuRadioItem must be rendered inside <DropdownMenuRadioGroup>.")
  }
  return ctx
}

type DropdownMenuRadioGroupState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type DropdownMenuRadioGroupActions = {
  choose: { value: string }
  clear: Record<string, never>
}

// Base UI types the group value as `any`; pinning `string | null` keeps the
// capability contract enforceable, where `null` is "no selection" — the empty
// sentinel Base UI already reports, so the Radix twin's ""-to-null mapping has
// no counterpart here.
type DropdownMenuRadioGroupProps = Omit<
  MenuPrimitive.RadioGroup.Props,
  "ref" | "value" | "defaultValue" | "onValueChange"
> & {
  value?: string
  defaultValue?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string | null) => void
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLDivElement>
  agent?: AgentProp
}

function DropdownMenuRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: DropdownMenuRadioGroupProps) {
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

  useCapability<DropdownMenuRadioGroupState, DropdownMenuRadioGroupActions>({
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

  const contextValue = React.useMemo<DropdownMenuRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <DropdownMenuRadioContext.Provider value={contextValue}>
      <MenuPrimitive.RadioGroup
        data-slot="dropdown-menu-radio-group"
        value={value}
        onValueChange={(next) => setValue(next)}
        ref={mergedRef}
        {...props}
      />
    </DropdownMenuRadioContext.Provider>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  disabled = false,
  ...props
}: Omit<MenuPrimitive.RadioItem.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  const { registerOption, describeOption } = useDropdownMenuRadioContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Omit<MenuPrimitive.GroupLabel.Props, "className"> & {
  className?: string
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: Omit<MenuPrimitive.Separator.Props, "className"> & {
  className?: string
}) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  // The Base UI submenu root renders no element, so it carries no data-slot.
  return <MenuPrimitive.SubmenuRoot {...props} />
}

type DropdownMenuSubTriggerState = {
  label: string
  disabled: boolean
}

type DropdownMenuSubTriggerActions = {
  press: Record<string, never>
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  disabled = false,
  agent,
  ...props
}: Omit<MenuPrimitive.SubmenuTrigger.Props, "ref" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  className?: string
  inset?: boolean
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const mergedRef = useMergedRef(ref, elementRef)

  // A sub-trigger opens a submenu rather than performing an action, but it is
  // still a thing you press: registering it as a button is what lets an agent
  // reach a nested menu at all. `kind: "button"` already exists and already
  // carries a `button_press` tool, so no new kind is needed.
  useCapability<DropdownMenuSubTriggerState, DropdownMenuSubTriggerActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "button",
    defaultLabel: label,
    read: () => ({ label, disabled }),
    actions: {
      press() {
        if (disabled) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        elementRef.current?.click()
      },
    },
  })

  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      disabled={disabled}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
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
          data-slot="dropdown-menu-sub-content"
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
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
