"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectNumberArray, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

type SliderState = {
  value: number[]
  min: number
  max: number
  step: number
  disabled: boolean
}

type SliderActions = {
  set: { value: number[] }
}

function Slider({
  className,
  defaultValue,
  value: valueProp,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onValueChange,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  agent?: AgentProp
}) {
  const elementRef = React.useRef<HTMLSpanElement>(null)
  const label = useAccessibleName(elementRef, "Slider")
  const mergedRef = useMergedRef(ref, elementRef)

  // The vendored source normalises value / defaultValue into one array to
  // decide how many thumbs to render. useControllableState does the same:
  // when neither prop is supplied the default is [min, max], matching the
  // stock source's _values memo.
  const [value, setValue] = useControllableState<number[]>({
    prop: valueProp,
    defaultProp: defaultValue ?? [min, max],
    onChange: onValueChange,
  })

  useCapability<SliderState, SliderActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "slider",
    defaultLabel: label,
    read: () => ({ value, min, max, step, disabled }),
    actions: {
      set(input) {
        const next = expectNumberArray(input, "value")
        if (disabled) {
          rejectState("Slider is disabled and cannot be changed.")
        }
        if (next.length === 0) {
          rejectState('"value" must not be empty.')
        }
        if (next.length !== value.length) {
          rejectState(
            `"value" must have exactly ${value.length} entries to match the number of thumbs. Received ${next.length}.`,
          )
        }
        for (const [index, entry] of next.entries()) {
          if (entry < min || entry > max) {
            rejectState(
              `Entry at index ${index} (${entry}) is outside the range ${min} to ${max}.`,
            )
          }
        }
        setValue(next)
      },
    },
  })

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: value.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
