"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"

// A native <textarea> changes its value through the same channel as <input>:
// set the .value property and let the input event propagate. React's onChange
// listens for that native event, so this works for controlled and uncontrolled
// textareas alike. Base UI has no textarea primitive — both bases render a
// plain <textarea>, so this file is the same binding as the Radix twin's.
function setNativeValue(node: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )
  descriptor?.set?.call(node, value)
  node.dispatchEvent(new Event("input", { bubbles: true }))
}

function assertMutable(node: HTMLTextAreaElement | null): HTMLTextAreaElement {
  if (!node) {
    rejectState("Textarea is not mounted.")
  }
  if (node.disabled) {
    rejectState("Textarea is disabled and cannot be changed.")
  }
  if (node.readOnly) {
    rejectState("Textarea is read-only and cannot be changed.")
  }
  return node
}

type TextareaState = {
  value: string
  disabled: boolean
  readOnly: boolean
  placeholder: string | null
}

type TextareaActions = {
  set_value: { value: string }
  clear: Record<string, never>
}

function Textarea({
  className,
  ref,
  agent,
  ...props
}: React.ComponentProps<"textarea"> & {
  agent?: AgentProp
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const label = useAccessibleName(textareaRef, "Textarea")
  const mergedRef = useMergedRef(ref, textareaRef)

  useCapability<TextareaState, TextareaActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "input",
    defaultLabel: label,
    read: () => {
      const node = textareaRef.current
      if (!node) {
        return {
          value: "",
          disabled: false,
          readOnly: false,
          placeholder: null,
        }
      }
      return {
        value: node.value,
        disabled: node.disabled,
        readOnly: node.readOnly,
        placeholder: node.placeholder || null,
      }
    },
    actions: {
      set_value(input) {
        const next = expectString(input, "value")
        const node = assertMutable(textareaRef.current)
        setNativeValue(node, next)
      },
      clear() {
        const node = assertMutable(textareaRef.current)
        setNativeValue(node, "")
      },
    },
  })

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      ref={mergedRef}
      {...props}
    />
  )
}

export { Textarea }
