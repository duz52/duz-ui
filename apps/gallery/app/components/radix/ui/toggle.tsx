"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectBoolean, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ToggleState = {
  checked: boolean
  disabled: boolean
}

type ToggleActions = {
  set: { checked: boolean }
}

function Toggle({
  className,
  variant,
  size,
  pressed: pressedProp,
  defaultPressed,
  onPressedChange,
  disabled = false,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    agent?: AgentProp
  }) {
  const elementRef = React.useRef<HTMLButtonElement>(null)
  const label = useAccessibleName(elementRef, "Toggle")
  const mergedRef = useMergedRef(ref, elementRef)

  const [pressed, setPressed] = useControllableState<boolean>({
    prop: pressedProp,
    defaultProp: defaultPressed ?? false,
    onChange: onPressedChange,
  })

  useCapability<ToggleState, ToggleActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "checkbox",
    defaultLabel: label,
    read: () => ({ checked: pressed, disabled }),
    actions: {
      set(input) {
        const next = expectBoolean(input, "checked")
        if (disabled) {
          rejectState("Toggle is disabled and cannot be changed.")
        }
        setPressed(next)
      },
    },
  })

  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      pressed={pressed}
      onPressedChange={setPressed}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
