"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

type NativeSelectState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type NativeSelectActions = {
  choose: { value: string }
  clear: Record<string, never>
}

/**
 * The options a native select offers, read from the elements it was given
 * rather than from the `<option>` elements in the DOM. Reading the elements
 * keeps `read().options` independent of rendering — one mechanism shared with
 * every other select-kind component.
 *
 * An application that supplies options through a component which renders
 * `NativeSelectOption` internally is invisible to this walk, and that select
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
      if (child.type === NativeSelectOption) {
        options.push({
          value: String(props.value),
          label: typeof props.children === "string" ? props.children : undefined,
          disabled: props.disabled ?? false,
        })
        continue
      }
      // Option groups and fragments nest the options one level deeper.
      visit(props.children)
    }
  }

  visit(children)
  return options
}

// The wrapper owns the value channel: a single string, where "" is "no
// selection" — the sentinel every select-kind component reports as `null`.
// The native `value` wideness (number, string[]) has no place in that
// contract, so the value props are redeclared, not inherited.
type NativeSelectProps = Omit<React.ComponentProps<"select">, "size" | "value" | "defaultValue"> & {
  size?: "sm" | "default"
  value?: string
  defaultValue?: string
  // Fires for both a user's change and an agent's action.
  onValueChange?: (value: string) => void
  agent?: AgentProp
}

function NativeSelect({
  value: valueProp,
  defaultValue,
  // The wrapper owns the value channel: the native change event cannot be
  // produced for an agent action (no DOM automation), so `onValueChange` is
  // the one callback that fires for both a user's change and an agent's.
  onValueChange,
  onChange,
  disabled = false,
  className,
  size = "default",
  children,
  ref,
  agent,
  ...props
}: NativeSelectProps) {
  const selectRef = React.useRef<HTMLSelectElement>(null)
  const label = useAccessibleName(selectRef, "Native select")
  const identitySource = useAccessibleNameResolver(selectRef)
  const mergedRef = useMergedRef(ref, selectRef)

  const options = readOptions(children)

  // A browser selects the first selectable option when a `<select>` carries
  // no explicit initial value; starting there keeps the component's stock
  // meaning and makes `read()` report what is actually shown.
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? options.find((option) => !option.disabled)?.value ?? "",
    onChange: onValueChange,
  })

  // A disabled select cannot be changed at all, so every option in it is
  // unselectable — folding it in here means the refusal an agent gets is the
  // one it already knows, and the capability never reports an option it would
  // decline to set.
  const selectableOptions = options.map((option) => ({
    ...option,
    disabled: option.disabled || disabled,
  }))

  useCapability<NativeSelectState, NativeSelectActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "select",
    defaultLabel: label,
    identitySource,
    read: () => ({
      value: value === "" ? null : value,
      options: selectableOptions,
    }),
    actions: {
      choose(input) {
        const next = expectString(input, "value")
        const match = selectableOptions.find((option) => option.value === next)
        if (!match) {
          const known = selectableOptions.map((option) => option.value)
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

  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        ref={mergedRef}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.currentTarget.value)
          // The native change event fires on user interaction only — never on
          // an agent action, which updates state directly — so this listener
          // keeps its native semantics without becoming a second value
          // channel.
          onChange?.(event)
        }}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
