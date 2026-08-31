"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

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
  containerClassName,
  value: valueProp,
  defaultValue,
  onChange,
  maxLength,
  disabled = false,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLInputElement>(null)
  const label = useAccessibleName(elementRef, "One-time code")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // The input-otp package is controlled through value / onChange, not through
  // a native element, so useControllableState manages the value the way
  // checkbox.tsx does rather than the native-setter path input.tsx uses.
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: (defaultValue as string | undefined) ?? "",
    onChange: onChange,
  })

  useCapability<InputOTPState, InputOTPActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "input",
    defaultLabel: label,
    identitySource,
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
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      value={value}
      onChange={setValue}
      maxLength={maxLength}
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

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
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
