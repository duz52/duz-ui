"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectString, rejectState } from "@/lib/duz-ui/validate"

// A native <input> has exactly one semantic channel for changing its value:
// setting the .value property and letting the input event propagate. React's
// onChange is a delegated listener for that native event, so this mechanism
// works whether the input is controlled or uncontrolled. Base UI's Input
// renders a native <input>, so the channel is the same as the Radix twin's.
function setNativeValue(node: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )
  descriptor?.set?.call(node, value)
  node.dispatchEvent(new Event("input", { bubbles: true }))
}

function assertMutable(node: HTMLElement | null): HTMLInputElement {
  if (!(node instanceof HTMLInputElement)) {
    rejectState("Input is not mounted.")
  }
  if (node.disabled) {
    rejectState("Input is disabled and cannot be changed.")
  }
  if (node.readOnly) {
    rejectState("Input is read-only and cannot be changed.")
  }
  return node
}

type InputState = {
  value: string
  type: string
  disabled: boolean
  readOnly: boolean
  placeholder: string | null
}

type InputActions = {
  set_value: { value: string }
  clear: Record<string, never>
}

function Input({
  className,
  type,
  ref,
  agent,
  ...props
}: Omit<InputPrimitive.Props, "ref" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLElement>
  className?: string
  agent?: AgentProp
}) {
  const inputRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(inputRef, "Input")
  const identitySource = useAccessibleNameResolver(inputRef)
  const mergedRef = useMergedRef(ref, inputRef)

  useCapability<InputState, InputActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "input",
    defaultLabel: label,
    identitySource,
    read: () => {
      const node = inputRef.current
      if (!(node instanceof HTMLInputElement)) {
        return {
          value: "",
          type: type ?? "text",
          disabled: false,
          readOnly: false,
          placeholder: null,
        }
      }
      return {
        value: node.value,
        type: node.type,
        disabled: node.disabled,
        readOnly: node.readOnly,
        placeholder: node.placeholder || null,
      }
    },
    actions: {
      set_value(input) {
        const next = expectString(input, "value")
        const node = assertMutable(inputRef.current)
        setNativeValue(node, next)
      },
      clear() {
        const node = assertMutable(inputRef.current)
        setNativeValue(node, "")
      },
    },
  })

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40",
        className
      )}
      ref={mergedRef}
      {...props}
    />
  )
}

export { Input }
