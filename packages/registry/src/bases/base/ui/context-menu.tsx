"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { pressElement } from "@/lib/agent-ui/press"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectBoolean, expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

type ContextMenuState = {
  open: boolean
  disabled: boolean
}

type ContextMenuActions = {
  open: Record<string, never>
  close: Record<string, never>
  toggle: Record<string, never>
}

function ContextMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled = false,
  agent,
  ...props
}: Omit<ContextMenuPrimitive.Root.Props, "onOpenChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onOpenChange?: (open: boolean) => void
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  const { id } = useCapability<ContextMenuState, ContextMenuActions>({
    agent,
    kind: "disclosure",
    defaultLabel: "Context menu",
    read: () => ({ open, disabled }),
    actions: {
      open() {
        if (disabled) {
          rejectState("Context menu is disabled and cannot be changed.")
        }
        setOpen(true)
      },
      close() {
        if (disabled) {
          rejectState("Context menu is disabled and cannot be changed.")
        }
        setOpen(false)
      },
      toggle() {
        if (disabled) {
          rejectState("Context menu is disabled and cannot be changed.")
        }
        setOpen(!open)
      },
    },
  })

  // The Base UI root renders no element, so it carries no data-slot. Every
  // capability rendered inside the menu — its items — belongs to it. When the
  // menu opted out, `id` is undefined and the provider passes
  // `ownerId: undefined` through, so descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <ContextMenuPrimitive.Root
        open={open}
        onOpenChange={(next) => setOpen(next)}
        disabled={disabled}
        {...props}
      />
    </AgentContainerProvider>
  )
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  )
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
  // The Base UI submenu root renders no element, so it carries no data-slot.
  return <ContextMenuPrimitive.SubmenuRoot {...props} />
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
interface ContextMenuRadioContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerOption: (value: string) => () => void
  describeOption: (value: string, label: string | undefined, disabled: boolean) => void
}

const ContextMenuRadioContext = React.createContext<ContextMenuRadioContextValue | null>(null)

function useContextMenuRadioContext(): ContextMenuRadioContextValue {
  const ctx = React.useContext(ContextMenuRadioContext)
  if (!ctx) {
    throw new Error("ContextMenuRadioItem must be rendered inside <ContextMenuRadioGroup>.")
  }
  return ctx
}

type ContextMenuRadioGroupState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type ContextMenuRadioGroupActions = {
  choose: { value: string }
  clear: Record<string, never>
}

// Base UI types the group value as `any`; pinning `string | null` keeps the
// capability contract enforceable, where `null` is "no selection" — the empty
// sentinel Base UI already reports, so the Radix twin's ""-to-null mapping has
// no counterpart here.
type ContextMenuRadioGroupProps = Omit<
  ContextMenuPrimitive.RadioGroup.Props,
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

function ContextMenuRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: ContextMenuRadioGroupProps) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Menu options")
  const identitySource = useAccessibleNameResolver(groupRef)
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

  useCapability<ContextMenuRadioGroupState, ContextMenuRadioGroupActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "select",
    defaultLabel: label,
    identitySource,
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

  const contextValue = React.useMemo<ContextMenuRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <ContextMenuRadioContext.Provider value={contextValue}>
      <ContextMenuPrimitive.RadioGroup
        data-slot="context-menu-radio-group"
        value={value}
        onValueChange={(next) => setValue(next)}
        ref={mergedRef}
        {...props}
      />
    </ContextMenuRadioContext.Provider>
  )
}

type ContextMenuSubTriggerState = {
  label: string
  disabled: boolean
}

type ContextMenuSubTriggerActions = {
  press: Record<string, never>
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  disabled = false,
  agent,
  ...props
}: Omit<ContextMenuPrimitive.SubmenuTrigger.Props, "ref" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  className?: string
  inset?: boolean
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // A sub-trigger opens a submenu rather than performing an action, but it is
  // still a thing you press: registering it as a button is what lets an agent
  // reach a nested menu at all. `kind: "button"` already exists and already
  // carries a `button_press` tool, so no new kind is needed.
  useCapability<ContextMenuSubTriggerState, ContextMenuSubTriggerActions>({
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
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      disabled={disabled}
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({
  className,
  side,
  align,
  alignOffset,
  sideOffset,
  collisionPadding,
  ...props
}: Omit<
  ContextMenuPrimitive.Popup.Props &
    Pick<
      ContextMenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    >,
  "className"
> & {
  className?: string
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(
            "z-50 min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuContent({
  className,
  side,
  align,
  alignOffset,
  sideOffset,
  collisionPadding,
  ...props
}: Omit<
  ContextMenuPrimitive.Popup.Props &
    Pick<
      ContextMenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    >,
  "className"
> & {
  className?: string
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

type ContextMenuItemState = {
  label: string
  disabled: boolean
}

type ContextMenuItemActions = {
  press: Record<string, never>
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ref,
  disabled = false,
  agent,
  ...props
}: Omit<ContextMenuPrimitive.Item.Props, "ref" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  className?: string
  inset?: boolean
  variant?: "default" | "destructive"
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // A menu item is a thing you press. `kind: "button"` already exists and
  // already carries a `button_press` tool, so modelling the item as a new
  // kind would multiply the protocol for no gain.
  useCapability<ContextMenuItemState, ContextMenuItemActions>({
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
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
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

type ContextMenuCheckboxItemState = {
  checked: boolean
  disabled: boolean
}

type ContextMenuCheckboxItemActions = {
  set: { checked: boolean }
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  ref,
  agent,
  ...props
}: Omit<ContextMenuPrimitive.CheckboxItem.Props, "ref" | "onCheckedChange" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onCheckedChange?: (checked: boolean) => void
  className?: string
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Menu checkbox")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  const [checked, setChecked] = useControllableState<boolean>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  })

  useCapability<ContextMenuCheckboxItemState, ContextMenuCheckboxItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    identitySource,
    read: () => ({ checked, disabled }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Context menu checkbox is disabled and cannot be changed.")
        }
        setChecked(next)
      },
    },
  })

  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
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
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  value,
  disabled = false,
  ...props
}: Omit<ContextMenuPrimitive.RadioItem.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  const { registerOption, describeOption } = useContextMenuRadioContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: Omit<ContextMenuPrimitive.GroupLabel.Props, "className"> & {
  className?: string
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium text-foreground data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: Omit<ContextMenuPrimitive.Separator.Props, "className"> & {
  className?: string
}) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
