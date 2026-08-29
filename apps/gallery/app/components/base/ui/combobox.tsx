"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { Button } from "@/components/base/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/base/ui/input-group"
import { ChevronDownIcon, XIcon, CheckIcon } from "lucide-react"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { agentWithElementId } from "@/lib/agent-ui/agent-identity"
import { expectString, expectStringArray, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * The content declares the options; the chosen value stays with the Combobox
 * wrapper, so nothing is duplicated into this context.
 */
interface ComboboxContextValue {
  setOptions: (options: OptionEntry[]) => void
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useComboboxContext(): ComboboxContextValue {
  const ctx = React.useContext(ComboboxContext)
  if (!ctx) {
    throw new Error("ComboboxContent must be rendered inside <Combobox>.")
  }
  return ctx
}

// The kind depends on the mode: a single-choice combobox is a select, a
// multiple-choice combobox is a multi-select. The option list is the same.
type ComboboxSingleState = {
  value: string | null
  options: OptionEntry[]
}

type ComboboxMultipleState = {
  value: string[]
  options: OptionEntry[]
}

type ComboboxSingleActions = {
  choose: { value: string }
  clear: Record<string, never>
}

type ComboboxMultipleActions = {
  set: { values: string[] }
}

// Single mode holds `string | null`; multiple mode holds `string[]` — the
// same shapes the primitive hands out, pinned to string. The conditional
// mirrors the primitive's value type, which the package does not export.
type ComboboxSelection<Multiple extends boolean | undefined> = Multiple extends true
  ? string[]
  : string | null

type ComboboxProps<Multiple extends boolean | undefined = false> = Omit<
  ComboboxPrimitive.Root.Props<string, Multiple>,
  "onValueChange" | "value" | "defaultValue"
> & {
  value?: ComboboxSelection<Multiple>
  defaultValue?: ComboboxSelection<Multiple>
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: ComboboxSelection<Multiple>) => void
  agent?: AgentProp
}

/**
 * The refusal wording is the select's, character for character — single mode
 * is kind "select" and an agent's retry logic reads these messages. The `set`
 * action runs the same check on every value it is handed.
 */
function assertSelectable(options: OptionEntry[], value: string): void {
  const match = options.find((option) => option.value === value)
  if (!match) {
    const known = options.map((option) => option.value)
    rejectState(
      `Option "${value}" is not available. Available options: ${known.length ? known.join(", ") : "(none)"}.`,
    )
  }
  if (match.disabled) {
    rejectState(`Option "${value}" is disabled and cannot be selected.`)
  }
}

/**
 * The options a combobox offers, read from the elements its content was
 * given rather than from items that have mounted. The primitive filters the
 * rendered items against the input's text, so reading mounted items would
 * make `read().options` depend on what the agent has typed; reading the
 * elements reports the full option list the application declared, whether
 * the popup is open or a filter is active.
 *
 * An application that supplies items through a component which renders
 * `ComboboxItem` internally is invisible to this walk, and that combobox
 * reports no options.
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
      if (child.type === ComboboxItem) {
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

function Combobox<Multiple extends boolean | undefined = false>({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  agent,
  ...props
}: ComboboxProps<Multiple>) {
  const isMultiple = props.multiple === true

  const [value, setValue] = useControllableState<ComboboxSelection<Multiple>>({
    prop: valueProp,
    defaultProp: (isMultiple ? [] : null) as ComboboxSelection<Multiple>,
    onChange: onValueChange,
  })

  const [options, setOptions] = React.useState<OptionEntry[]>([])

  // A disabled combobox cannot be changed at all, so every option in it is
  // unselectable — folding it in here means the refusal an agent gets is the
  // one it already knows, and the capability never reports an option it would
  // decline to set.
  const selectableOptions = options.map((option) => ({
    ...option,
    disabled: option.disabled || disabled,
  }))

  useCapability<
    ComboboxSingleState | ComboboxMultipleState,
    ComboboxSingleActions | ComboboxMultipleActions
  >(
    isMultiple
      ? {
          agent: agentWithElementId(agent, props.id),
          kind: "multi-select",
          defaultLabel: "Combobox",
          read: (): ComboboxMultipleState => ({
            value: value as string[],
            options: selectableOptions,
          }),
          actions: {
            set(input: { values: string[] }) {
              const next = expectStringArray(input, "values")
              for (const entry of next) {
                assertSelectable(selectableOptions, entry)
              }
              setValue(next as ComboboxSelection<Multiple>)
            },
          },
        }
      : {
          agent: agentWithElementId(agent, props.id),
          kind: "select",
          defaultLabel: "Combobox",
          read: (): ComboboxSingleState => ({
            value: value as string | null,
            options: selectableOptions,
          }),
          actions: {
            choose(input: { value: string }) {
              const next = expectString(input, "value")
              assertSelectable(selectableOptions, next)
              setValue(next as ComboboxSelection<Multiple>)
            },
            clear() {
              setValue(null as ComboboxSelection<Multiple>)
            },
          },
        },
  )

  const contextValue = React.useMemo<ComboboxContextValue>(
    () => ({ setOptions }),
    [setOptions],
  )

  return (
    <ComboboxContext.Provider value={contextValue}>
      {/* The Base UI root renders no element, so it carries no data-slot. */}
      <ComboboxPrimitive.Root
        disabled={disabled}
        value={value as ComboboxPrimitive.Root.Props<string, Multiple>["value"]}
        onValueChange={(next) => setValue(next as ComboboxSelection<Multiple>)}
        {...props}
      />
    </ComboboxContext.Provider>
  )
}

function ComboboxValue({
  ...props
}: Omit<ComboboxPrimitive.Value.Props, "className"> & {
  className?: string
}) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: Omit<ComboboxPrimitive.Trigger.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxClear({
  className,
  ...props
}: Omit<ComboboxPrimitive.Clear.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "className"> & {
  className?: string
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: Omit<ComboboxPrimitive.Popup.Props, "className"> &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  > & {
    className?: string
  }) {
  const { setOptions } = useComboboxContext()
  const options = readOptions(children)
  const latest = React.useRef(options)
  latest.current = options
  const key = optionsKey(options)
  React.useEffect(() => {
    setOptions(latest.current)
  }, [setOptions, key])

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn("group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({
  className,
  ...props
}: Omit<ComboboxPrimitive.List.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: Omit<ComboboxPrimitive.Item.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({
  className,
  ...props
}: Omit<ComboboxPrimitive.Group.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
}

function ComboboxLabel({
  className,
  ...props
}: Omit<ComboboxPrimitive.GroupLabel.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
}

function ComboboxEmpty({
  className,
  ...props
}: Omit<ComboboxPrimitive.Empty.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: Omit<ComboboxPrimitive.Separator.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips>, "className"> &
  ComboboxPrimitive.Chips.Props & {
    className?: string
  }) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: Omit<ComboboxPrimitive.Chip.Props, "className"> & {
  className?: string
  showRemove?: boolean
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "className"> & {
  className?: string
}) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
