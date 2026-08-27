"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { expectBoolean, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

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
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  agent?: AgentProp
}) {
  const [checked, setChecked] = useControllableState<Checked>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  })

  useCapability<CheckboxState, CheckboxActions>({
    agent,
    kind: "checkbox",
    defaultLabel: "Checkbox",
    read: () => ({ checked, disabled }),
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
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
        className
      )}
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
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
