"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { pressElement } from "@/lib/agent-ui/press"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
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
  /**
   * The trigger attaches itself here. The root's own name lives in the
   * trigger's text, and the trigger is the part that stays mounted, so this
   * is what the root's id is derived from — read at registration, before the
   * reported label has made its way back through state.
   */
  nameRef: React.RefObject<HTMLElement | null>
}

const DropdownMenuTriggerContext = React.createContext<DropdownMenuTriggerContextValue | null>(null)

function useDropdownMenuTriggerContext(): DropdownMenuTriggerContextValue {
  const ctx = React.useContext(DropdownMenuTriggerContext)
  if (!ctx) {
    throw new Error("DropdownMenuTrigger must be rendered inside <DropdownMenu>.")
  }
  return ctx
}

function DropdownMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  agent,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root> & {
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  const [triggerLabel, setTriggerLabel] = React.useState<string | null>(null)
  const nameRef = React.useRef<HTMLElement | null>(null)
  const identitySource = useAccessibleNameResolver(nameRef)

  // Ignore a label the root already holds, so a repeated report cannot loop.
  const reportTriggerLabel = React.useCallback((label: string | null) => {
    setTriggerLabel((prev) => (prev === label ? prev : label))
  }, [])

  const { id } = useCapability<DropdownMenuState, DropdownMenuActions>({
    agent,
    kind: "disclosure",
    defaultLabel: triggerLabel ?? "Dropdown menu",
    identitySource,
    read: () => ({ open, disabled: false }),
    actions: {
      open() {
        setOpen(true)
      },
      close() {
        setOpen(false)
      },
      toggle() {
        setOpen(!open)
      },
    },
  })

  const contextValue = React.useMemo<DropdownMenuTriggerContextValue>(
    () => ({ setTriggerLabel: reportTriggerLabel, nameRef }),
    [reportTriggerLabel],
  )

  // Every capability rendered inside the menu — its items — belongs to it.
  // When the menu opted out, `id` is undefined and the provider passes
  // `ownerId: undefined` through, so descendants stay roots.
  return (
    <DropdownMenuTriggerContext.Provider value={contextValue}>
      <AgentContainerProvider ownerId={id}>
        <DropdownMenuPrimitive.Root
          data-slot="dropdown-menu"
          open={open}
          onOpenChange={setOpen}
          {...props}
        />
      </AgentContainerProvider>
    </DropdownMenuTriggerContext.Provider>
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const { setTriggerLabel, nameRef } = useDropdownMenuTriggerContext()
  const elementRef = React.useRef<HTMLButtonElement>(null)
  // An empty resolution means the trigger carries no name; reporting null
  // lets the root keep its generic default.
  const label = useAccessibleName(elementRef, "")
  const mergedRef = useMergedRef(ref, elementRef, nameRef)

  // Reported in an effect: the name exists only once the element is mounted.
  React.useEffect(() => {
    setTriggerLabel(label === "" ? null : label)
  }, [setTriggerLabel, label])

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      ref={mergedRef}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Menu item")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // A menu item is a thing you press. `kind: "button"` already exists and
  // already carries a `button_press` tool, so modelling the item as a new
  // kind would multiply the protocol for no gain.
  useCapability<DropdownMenuItemState, DropdownMenuItemActions>({
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
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
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
}: Omit<React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>, "checked"> & {
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

  useCapability<DropdownMenuCheckboxItemState, DropdownMenuCheckboxItemActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    identitySource,
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
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * Items only need to announce themselves. The chosen value stays with Radix,
 * so nothing is duplicated into this context.
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

function DropdownMenuRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup> & {
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

  useCapability<DropdownMenuRadioGroupState, DropdownMenuRadioGroupActions>({
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

  const contextValue = React.useMemo<DropdownMenuRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <DropdownMenuRadioContext.Provider value={contextValue}>
      <DropdownMenuPrimitive.RadioGroup
        data-slot="dropdown-menu-radio-group"
        value={value}
        onValueChange={setValue}
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  const { registerOption, describeOption } = useDropdownMenuRadioContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
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

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
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
  useCapability<DropdownMenuSubTriggerState, DropdownMenuSubTriggerActions>({
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
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      disabled={disabled}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
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
