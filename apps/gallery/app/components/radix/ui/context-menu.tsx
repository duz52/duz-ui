"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
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
  onOpenChange,
  agent,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root> & {
  agent?: AgentProp
}) {
  const [open, setOpen] = useControllableState<boolean>({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  })

  useCapability<ContextMenuState, ContextMenuActions>({
    agent,
    kind: "disclosure",
    defaultLabel: "Context menu",
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

  return (
    <ContextMenuPrimitive.Root
      data-slot="context-menu"
      open={open}
      onOpenChange={setOpen}
      {...props}
    />
  )
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  )
}

function ContextMenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
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

function ContextMenuRadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup> & {
  defaultValue?: string
  agent?: AgentProp
}) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Menu options")
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

  useCapability<ContextMenuRadioGroupState, ContextMenuRadioGroupActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "select",
    defaultLabel: label,
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

  const contextValue = React.useMemo<ContextMenuRadioContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <ContextMenuRadioContext.Provider value={contextValue}>
      <ContextMenuPrimitive.RadioGroup
        data-slot="context-menu-radio-group"
        value={value}
        onValueChange={setValue}
        ref={mergedRef}
        {...props}
      />
    </ContextMenuRadioContext.Provider>
  )
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

// ContextMenuItem has no agent capability. Its meaning is the application's
// onSelect handler, not the component's own state — exposing it would let an
// agent invoke arbitrary application logic the application never declared.
// Use AgentAction to declare an explicit agent action when needed.
function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
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
}: Omit<React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>, "checked"> & {
  checked?: boolean
  defaultChecked?: boolean
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Menu checkbox")
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
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
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
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
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
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Label
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
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
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
