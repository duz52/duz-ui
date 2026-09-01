"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectBoolean, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

type Checked = boolean | "indeterminate"

type CheckboxState = {
  checked: Checked
  disabled: boolean
}

type CheckboxActions = {
  set: { checked: boolean }
}

function Checkbox({
  className,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  indeterminate = false,
  disabled = false,
  ref,
  agent,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "ref" | "onCheckedChange" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onCheckedChange?: (checked: boolean) => void
  className?: string
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Checkbox")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  const [checked, setChecked] = useControllableState<boolean>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  })

  // Base UI factors indeterminate out of `checked` into its own prop; the
  // capability folds it back so the agent reads the same shape as Radix.
  useCapability<CheckboxState, CheckboxActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    identitySource,
    read: () => ({
      checked: indeterminate ? "indeterminate" : checked,
      disabled,
    }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Checkbox is disabled and cannot be changed.")
        }
        setChecked(next)
      },
    },
  })

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-destructive data-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:bg-input/30 dark:data-invalid:ring-destructive/40 dark:data-checked:bg-primary",
        className
      )}
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={(next) => setChecked(next)}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
