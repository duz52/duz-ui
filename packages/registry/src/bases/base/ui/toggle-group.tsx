"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectString, expectStringArray, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
})

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

// The kind depends on the mode: a single-choice group is a select, a
// multiple-choice group is a multi-select. The option list is the same.
type ToggleGroupSingleState = {
  value: string | null
  options: OptionEntry[]
}

type ToggleGroupMultipleState = {
  value: string[]
  options: OptionEntry[]
}

type ToggleGroupSingleActions = {
  choose: { value: string }
  clear: Record<string, never>
}

type ToggleGroupMultipleActions = {
  set: { values: string[] }
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
 * The options a toggle group offers, read from the elements it was given
 * rather than registered by items as they mount. Group items are always
 * mounted, so a mount effect would work too — but one mechanism is better
 * than two, and reading the elements keeps `read().options` independent of
 * rendering.
 *
 * An application that supplies items through a component which renders
 * `ToggleGroupItem` internally is invisible to this walk, and that group
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
      if (child.type === ToggleGroupItem) {
        options.push({
          value: String(props.value),
          label: typeof props.children === "string" ? props.children : undefined,
          disabled: props.disabled ?? false,
        })
        continue
      }
      // Wrappers and fragments nest the items one level deeper.
      visit(props.children)
    }
  }

  visit(children)
  return options
}

// Base UI types the group value as a readonly array of a generic string type.
// Pinning `string[]` keeps the capability contract enforceable end to end: the
// base's own change payload is already `string[]`, and a `string[]` call site
// satisfies the base's `readonly` input wherever the primitive receives it.
type ToggleGroupProps = Omit<
  ToggleGroupPrimitive.Props,
  "onValueChange" | "value" | "defaultValue" | "className"
> &
  VariantProps<typeof toggleVariants> & {
    // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
    onValueChange?: (value: string[]) => void
    value?: string[]
    defaultValue?: string[]
    spacing?: number
    orientation?: "horizontal" | "vertical"
    className?: string
    agent?: AgentProp
  }

function ToggleGroup({
  multiple = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  children,
  disabled = false,
  ref,
  agent,
  ...props
}: ToggleGroupProps) {
  const isMultiple = multiple

  const [value, setValue] = useControllableState<string[]>({
    prop: valueProp,
    defaultProp: defaultValue ?? [],
    onChange: onValueChange,
  })

  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Toggle group")
  const identitySource = useAccessibleNameResolver(groupRef)
  const mergedRef = useMergedRef(ref, groupRef)

  // A disabled group cannot be changed at all, so every option in it is
  // unselectable — folding it in here means the refusal an agent gets is the
  // one it already knows, and the capability never reports an option it would
  // decline to set.
  const options = readOptions(children).map((option) => ({
    ...option,
    disabled: option.disabled || disabled,
  }))

  useCapability<
    ToggleGroupSingleState | ToggleGroupMultipleState,
    ToggleGroupSingleActions | ToggleGroupMultipleActions
  >(
    isMultiple
      ? {
          agent: agentWithElementId(agent, props.id),
          kind: "multi-select",
          defaultLabel: label,
          identitySource,
          read: (): ToggleGroupMultipleState => ({ value, options }),
          actions: {
            set(input: { values: string[] }) {
              const next = expectStringArray(input, "values")
              for (const entry of next) {
                assertSelectable(options, entry)
              }
              setValue(next)
            },
          },
        }
      : {
          agent: agentWithElementId(agent, props.id),
          kind: "select",
          defaultLabel: label,
          identitySource,
          read: (): ToggleGroupSingleState => ({
            value: value[0] ?? null,
            options,
          }),
          actions: {
            choose(input: { value: string }) {
              const next = expectString(input, "value")
              assertSelectable(options, next)
              setValue([next])
            },
            clear() {
              setValue([])
            },
          },
        },
  )

  return (
    <ToggleGroupContext.Provider
      value={{ variant, size, spacing, orientation }}
    >
      <ToggleGroupPrimitive
        disabled={disabled}
        data-slot="toggle-group"
        data-variant={variant}
        data-size={size}
        data-spacing={spacing}
        data-orientation={orientation}
        style={{ "--gap": spacing } as React.CSSProperties}
        className={cn(
          "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
          className
        )}
        multiple={multiple}
        value={value}
        onValueChange={(next) => setValue(next)}
        ref={mergedRef}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive>
    </ToggleGroupContext.Provider>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
