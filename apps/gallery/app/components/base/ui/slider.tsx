"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName, useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectNumberArray, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

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
}: Omit<SliderPrimitive.Root.Props<number[]>, "onValueChange" | "className"> & {
  /** Matches the ref type the library publishes on the component itself. */
  ref?: React.Ref<HTMLDivElement>
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: number[]) => void
  className?: string
  agent?: AgentProp
}) {
  // Base UI's Slider.Root renders a <div>, so the identity ref and the
  // accessible-name lookup land on the element the application sees.
  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Slider")
  const identitySource = useAccessibleNameResolver(elementRef)
  const mergedRef = useMergedRef(ref, elementRef)

  // useControllableState normalises value / defaultValue into one array to
  // decide how many thumbs to render. When neither prop is supplied the
  // default is [min, max], matching the stock source's _values memo.
  const [value, setValue] = useControllableState<number[]>({
    prop: valueProp,
    defaultProp: defaultValue ?? [min, max],
    onChange: onValueChange,
  })

  useCapability<SliderState, SliderActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "slider",
    defaultLabel: label,
    identitySource,
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
      onValueChange={(next) => setValue(next)}
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
      {/* Control is the pointer surface; positioning the thumbs against the
          track alone would leave most of the slider unclickable. */}
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex w-full touch-none items-center select-none data-[orientation=vertical]:h-full"
      >
        {/* No overflow-hidden: Base UI renders the thumbs inside the track,
            and clipping would cut them in half. */}
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
          )}
        >
          {/* The indicator's geometry is inline-styled by the library; only
              its colour comes from classes. It is Radix's Range, so it keeps
              the frozen slider-range slot name. */}
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary"
          />
          {Array.from({ length: value.length }, (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              key={index}
              index={index}
              className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
