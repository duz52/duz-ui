"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
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

function ToggleGroup({
  type,
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
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
    agent?: AgentProp
  }) {
  const isMultiple = type === "multiple"

  // Normalise both modes to string[] so the capability and the application's
  // change callback speak one shape; the primitive keeps its own per-mode
  // spelling below.
  const propArray: string[] | undefined = isMultiple
    ? (valueProp as string[] | undefined)
    : valueProp !== undefined
      ? [valueProp as string]
      : undefined

  const defaultArray: string[] = isMultiple
    ? (defaultValue as string[] | undefined) ?? []
    : defaultValue !== undefined
      ? [defaultValue as string]
      : []

  const handleValueChange = React.useCallback(
    (next: string[]) => {
      if (onValueChange === undefined) return
      if (isMultiple) {
        (onValueChange as (value: string[]) => void)(next)
      } else {
        (onValueChange as (value: string) => void)(next[0] ?? "")
      }
    },
    [isMultiple, onValueChange],
  )

  const [value, setValue] = useControllableState<string[]>({
    prop: propArray,
    defaultProp: defaultArray,
    onChange: handleValueChange,
  })

  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Toggle group")
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

  if (isMultiple) {
    return (
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        <ToggleGroupPrimitive.Root
          disabled={disabled}
          data-slot="toggle-group"
          type="multiple"
          value={value}
          onValueChange={setValue}
          data-variant={variant}
          data-size={size}
          data-spacing={spacing}
          data-orientation={orientation}
          style={{ "--gap": spacing } as React.CSSProperties}
          className={cn(
            "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
            className
          )}
          ref={mergedRef}
          {...props}
        >
          {children}
        </ToggleGroupPrimitive.Root>
      </ToggleGroupContext.Provider>
    )
  }

  return (
    <ToggleGroupContext.Provider
      value={{ variant, size, spacing, orientation }}
    >
      <ToggleGroupPrimitive.Root
        disabled={disabled}
        data-slot="toggle-group"
        type="single"
        value={value[0] ?? ""}
        onValueChange={(next: string) => setValue(next === "" ? [] : [next])}
        data-variant={variant}
        data-size={size}
        data-spacing={spacing}
        data-orientation={orientation}
        style={{ "--gap": spacing } as React.CSSProperties}
        className={cn(
          "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
          className
        )}
        ref={mergedRef}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Root>
    </ToggleGroupContext.Provider>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
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
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
