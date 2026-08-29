"use client"

import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface OptionEntry {
  value: string
  label?: string
  disabled: boolean
}

/**
 * Items only need to announce themselves. The chosen value stays with Radix,
 * so nothing is duplicated into this context.
 */
interface RadioGroupContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerOption: (value: string) => () => void
  describeOption: (value: string, label: string | undefined, disabled: boolean) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

function useRadioGroupContext(): RadioGroupContextValue {
  const ctx = React.useContext(RadioGroupContext)
  if (!ctx) {
    throw new Error("RadioGroupItem must be rendered inside <RadioGroup>.")
  }
  return ctx
}

type RadioGroupState = {
  value: string | null
  options: { value: string; label?: string; disabled: boolean }[]
}

type RadioGroupActions = {
  choose: { value: string }
  clear: Record<string, never>
}

function RadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  agent?: AgentProp
}) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(groupRef, "Radio group")
  const mergedRef = useMergedRef(ref, groupRef)

  const [value, setValue] = useControllableState<string>({
    prop: valueProp === null ? "" : valueProp,
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

  useCapability<RadioGroupState, RadioGroupActions>({
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

  const contextValue = React.useMemo<RadioGroupContextValue>(
    () => ({ registerOption, describeOption }),
    [registerOption, describeOption],
  )

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <RadioGroupPrimitive.Root
        data-slot="radio-group"
        className={cn("group flex flex-col gap-3", className)}
        value={value}
        onValueChange={setValue}
        ref={mergedRef}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
}

function RadioGroupItem({
  className,
  value,
  disabled = false,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  const { registerOption, describeOption } = useRadioGroupContext()
  const itemRef = React.useRef<HTMLButtonElement>(null)
  const mergedRef = useMergedRef(ref, itemRef)

  // Precedence for the option's label:
  // 1. string children — the item labels itself
  // 2. the accessible name resolved from the DOM (e.g. a sibling
  //    <Label htmlFor>) — the ordinary shadcn pattern
  // 3. undefined — never fall back to the value, which is already reported.
  // useAccessibleName returns its fallback when it finds nothing, so pass an
  // empty string and treat an empty result as "not found".
  const accessibleName = useAccessibleName(itemRef, "")
  const label =
    typeof children === "string" ? children : accessibleName || undefined

  React.useEffect(() => registerOption(value), [registerOption, value])
  React.useEffect(
    () => describeOption(value, label, disabled ?? false),
    [describeOption, value, label, disabled],
  )

  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      value={value}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <CircleIcon className="size-2.5 fill-current" />
      </RadioGroupPrimitive.Indicator>
      {children}
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
