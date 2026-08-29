"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * The content declares the options; the chosen value is owned by the Select
 * wrapper, so nothing is duplicated into this context.
 */
interface SelectContextValue {
  setOptions: (options: OptionEntry[]) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(): SelectContextValue {
  const ctx = React.useContext(SelectContext)
  if (!ctx) {
    throw new Error("SelectContent must be rendered inside <Select>.")
  }
  return ctx
}

type SelectState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type SelectActions = {
  choose: { value: string }
  clear: Record<string, never>
}

// Pinning the generic to `string` keeps the capability contract enforceable:
// the root's `value` stays `string | null`, where `null` is "no selection".
type SelectProps = Omit<SelectPrimitive.Root.Props<string>, "onValueChange"> & {
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string | null) => void
  agent?: AgentProp
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  agent,
  ...props
}: SelectProps) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
    onChange: onValueChange,
  })

  const [options, setOptions] = React.useState<OptionEntry[]>([])

  useCapability<SelectState, SelectActions>({
    agent,
    kind: "select",
    defaultLabel: "Select",
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

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({ setOptions }),
    [setOptions],
  )

  return (
    <SelectContext.Provider value={contextValue}>
      {/* The Base UI root renders no element, so it carries no data-slot. */}
      <SelectPrimitive.Root
        value={value}
        onValueChange={(next) => setValue(next)}
        {...props}
      />
    </SelectContext.Provider>
  )
}

function SelectGroup({
  ...props
}: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<SelectPrimitive.Trigger.Props, "className"> & {
  className?: string
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-destructive data-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:data-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="size-4 opacity-50" />}
      />
    </SelectPrimitive.Trigger>
  )
}

/**
 * The options a select offers, read from the elements its content was given
 * rather than from items that have mounted.
 *
 * Popup items are only rendered while the select is open, and whether that is
 * so is the primitive's business — it differs between bases and between
 * versions. Registering on mount therefore made `read().options` depend on the
 * select being open, and a closed select reported no options at all, so an
 * agent could neither discover an option nor choose one.
 *
 * An application that supplies items through a component which renders
 * `SelectItem` internally is invisible to this walk, and that select reports
 * no options.
 */
function readOptions(children: React.ReactNode): OptionEntry[] {
  const options: OptionEntry[] = []

  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue
      const props = child.props as {
        value?: unknown
        disabled?: boolean
        children?: React.ReactNode
      }
      if (child.type === SelectItem) {
        options.push({
          value: String(props.value),
          label: typeof props.children === "string" ? props.children : undefined,
          disabled: props.disabled ?? false,
        })
        continue
      }
      // Groups and fragments nest the items one level deeper.
      visit(props.children)
    }
  }

  visit(children)
  return options
}

/** Identity of an option list, so the content reports only real changes. */
function optionsKey(options: OptionEntry[]): string {
  return options
    .map((option) => [option.value, option.label ?? "", option.disabled].join("\u0000"))
    .join("\u0001")
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: Omit<
  SelectPrimitive.Popup.Props &
    Pick<
      SelectPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
    >,
  "className"
> & {
  className?: string
}) {
  const { setOptions } = useSelectContext()
  const options = readOptions(children)
  const latest = React.useRef(options)
  latest.current = options
  const key = optionsKey(options)
  React.useEffect(() => {
    setOptions(latest.current)
  }, [setOptions, key])

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative z-50 max-h-(--available-height) w-(--anchor-width) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[align-trigger=true]:animate-none",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: Omit<SelectPrimitive.GroupLabel.Props, "className"> & {
  className?: string
}) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  value,
  disabled = false,
  children,
  ...props
}: Omit<SelectPrimitive.Item.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      value={value}
      disabled={disabled}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: Omit<SelectPrimitive.Separator.Props, "className"> & {
  className?: string
}) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: Omit<SelectPrimitive.ScrollUpArrow.Props, "className"> & {
  className?: string
}) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 w-full flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: Omit<SelectPrimitive.ScrollDownArrow.Props, "className"> & {
  className?: string
}) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 w-full flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
