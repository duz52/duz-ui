"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectBoolean, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

type SwitchState = {
  checked: boolean
  disabled: boolean
}

type SwitchActions = {
  set: { checked: boolean }
}

function Switch({
  className,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLButtonElement>(null)
  const label = useAccessibleName(elementRef, "Switch")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  const [checked, setChecked] = useControllableState<boolean>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  })

  useCapability<SwitchState, SwitchActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    identitySource,
    read: () => ({ checked, disabled }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Switch is disabled and cannot be changed.")
        }
        setChecked(next)
      },
    },
  })

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/30",
        className
      )}
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-foreground shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 dark:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
