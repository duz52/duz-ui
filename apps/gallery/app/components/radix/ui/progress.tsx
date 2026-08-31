"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/agent-ui/agent-identity"

type ProgressState = {
  value: number | null
  max: number
}

// Progress is pure output: there is nothing on it a person can operate, so
// there is nothing for an agent to invoke. The empty action map states that,
// it does not omit it — the capability stays discoverable through ui_list and
// ui_read, and a kind with no actions adds no tool.
type ProgressActions = Record<never, never>

function Progress({
  className,
  value,
  // The primitive's own default, resolved here so read() reports the
  // effective max the indicator is measured against.
  max = 100,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Progress")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  useCapability<ProgressState, ProgressActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "progress",
    defaultLabel: label,
    identitySource,
    // An absent value and an explicit null are the same indeterminate state:
    // one representation, not two.
    read: () => ({ value: value ?? null, max }),
    actions: {},
  })

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
