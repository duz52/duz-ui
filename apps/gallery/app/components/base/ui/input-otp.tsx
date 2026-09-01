"use client"

import * as React from "react"
import { MinusIcon } from "lucide-react"
import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectString, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

type InputOTPState = {
  value: string
  disabled: boolean
  maxLength: number
}

type InputOTPActions = {
  set_value: { value: string }
  clear: Record<string, never>
}

function InputOTP({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  length: maxLength,
  disabled = false,
  ref,
  agent,
  ...props
}: Omit<OTPFieldPrimitive.Root.Props, "ref" | "onValueChange" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLDivElement>
  className?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string) => void
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "One-time code")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // The OTP field is controlled through value / onValueChange, not through a
  // native element, so useControllableState manages the value the way
  // checkbox.tsx does rather than the native-setter path input.tsx uses.
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  })

  useCapability<InputOTPState, InputOTPActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "input",
    defaultLabel: label,
    identitySource,
    // The agent-facing field stays maxLength; Base UI names the prop length.
    read: () => ({ value, disabled, maxLength }),
    actions: {
      set_value(input) {
        const next = expectString(input, "value")
        if (disabled) {
          rejectState("One-time code input is disabled and cannot be changed.")
        }
        if (next.length > maxLength) {
          rejectState(
            `Value is ${next.length} characters but the field expects at most ${maxLength}.`,
          )
        }
        setValue(next)
      },
      clear() {
        if (disabled) {
          rejectState("One-time code input is disabled and cannot be changed.")
        }
        setValue("")
      },
    },
  })

  return (
    <OTPFieldPrimitive.Root
      data-slot="input-otp"
      className={cn(
        "flex items-center gap-2 has-disabled:opacity-50 data-disabled:cursor-not-allowed",
        className
      )}
      value={value}
      onValueChange={(next) => setValue(next)}
      length={maxLength}
      disabled={disabled}
      ref={mergedRef}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

// Each Base UI slot is a real <input> holding its own character, so the
// radix twin's context-read char and fake caret have no equivalent here: the
// browser renders both. The active slot is simply the focused one, so the
// radix data-[active=true] selectors become focus: selectors.
function InputOTPSlot({
  className,
  ...props
}: Omit<OTPFieldPrimitive.Input.Props, "className"> & {
  className?: string
}) {
  return (
    <OTPFieldPrimitive.Input
      data-slot="input-otp-slot"
      className={cn(
        "relative h-9 w-9 border-y border-r border-input text-center text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-invalid:border-destructive focus:z-10 focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:data-invalid:border-destructive focus:data-invalid:ring-destructive/20 dark:bg-input/30 dark:focus:data-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
