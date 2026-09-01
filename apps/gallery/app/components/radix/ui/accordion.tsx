"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { useAccessibleNameResolver } from "@/lib/duz-ui/agent-identity"
import { expectString, rejectState } from "@/lib/duz-ui/validate"
import { useControllableState } from "@/lib/duz-ui/use-controllable-state"

interface ItemEntry {
  value: string
  /**
   * Resolved when an agent reads, not when the item renders. A label captured
   * at render arrives a commit late — the trigger that carries the text is a
   * descendant, so its name reached the root through the item's state — and
   * an option published without its label is one an agent can read, address
   * and display before it has a name. Reads are pull-based, so by the time
   * this runs the trigger is mounted and its name is simply there.
   */
  readLabel: () => string | undefined
  disabled: boolean
}

/**
 * Items only need to announce themselves. The open value stays with
 * useControllableState, so nothing is duplicated into this context.
 */
interface AccordionContextValue {
  /** Whether the root is disabled, so every item inherits it. */
  rootDisabled: boolean
  /** Mount and unmount only. Presentation never affects registration order. */
  registerItem: (value: string, readLabel: () => string | undefined) => () => void
  describeItem: (value: string, disabled: boolean) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

function useAccordionContext(): AccordionContextValue {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) {
    throw new Error("AccordionItem must be rendered inside <Accordion>.")
  }
  return ctx
}

/**
 * The item hands its trigger a ref so it can resolve the trigger's accessible
 * name on demand. Nothing is announced and nothing is stored: the name is read
 * from the element that carries it, at the moment an agent asks.
 */
interface AccordionItemContextValue {
  triggerRef: React.RefObject<HTMLElement | null>
}

const AccordionItemContext =
  React.createContext<AccordionItemContextValue | null>(null)

type AccordionState = {
  value: string[]
  items: { value: string; label?: string; disabled: boolean }[]
}

type AccordionActions = {
  expand: { value: string }
  collapse: { value: string }
}

function Accordion({
  type,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root> & {
  agent?: AgentProp
}) {
  const isMultiple = type === "multiple"

  // Normalise the controlled prop and default to string[] in both modes so the
  // agent always sees one shape. type="single" uses a string where "" means
  // nothing open; type="multiple" uses string[] directly.
  const propArray: string[] | undefined = isMultiple
    ? (valueProp as string[] | undefined)
    : valueProp !== undefined
      ? (valueProp as string) !== ""
        ? [valueProp as string]
        : []
      : undefined

  const defaultArray: string[] = isMultiple
    ? (defaultValue as string[] | undefined) ?? []
    : defaultValue !== undefined
      ? (defaultValue as string) !== ""
        ? [defaultValue as string]
        : []
      : []

  const handleValueChange = React.useCallback(
    (next: string[]) => {
      if (onValueChange === undefined) return
      if (isMultiple) {
        (onValueChange as (value: string[]) => void)(next)
      } else {
        (onValueChange as (value: string) => void)(next[0] ?? "")
      }
    },
    [isMultiple, onValueChange],
  )

  const [value, setValue] = useControllableState<string[]>({
    prop: propArray,
    defaultProp: defaultArray,
    onChange: handleValueChange,
  })

  const [items, setItems] = React.useState<ItemEntry[]>([])

  // Registration owns order, so it depends on the item's value alone. Label
  // and disabled state are updated in place; removing and re-appending on a
  // change would reorder what the agent reads.
  const registerItem = React.useCallback(
    (value: string, readLabel: () => string | undefined): (() => void) => {
      setItems((prev) =>
        prev.some((item) => item.value === value)
          ? prev
          : [...prev, { value, readLabel, disabled: false }],
      )
      return () => {
        setItems((prev) => prev.filter((item) => item.value !== value))
      }
    },
    [],
  )

  const describeItem = React.useCallback((value: string, disabled: boolean) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.value === value)
      const current = prev[index]
      if (!current) return prev
      if (current.disabled === disabled) return prev
      const next = [...prev]
      next[index] = { ...current, disabled }
      return next
    })
  }, [])

  useCapability<AccordionState, AccordionActions>({
    agent,
    kind: "accordion",
    defaultLabel: "Accordion",
    read: () => ({
      value,
      items: items.map((item) => ({
        value: item.value,
        label: item.readLabel(),
        disabled: item.disabled,
      })),
    }),
    actions: {
      expand(input) {
        const next = expectString(input, "value")
        const match = items.find((item) => item.value === next)
        if (!match) {
          const known = items.map((item) => item.value)
          rejectState(
            `Section "${next}" is not available. Available sections: ${known.length ? known.join(", ") : "(none)"}.`,
          )
        }
        if (match.disabled) {
          rejectState(`Section "${next}" is disabled and cannot be expanded.`)
        }
        setValue(value.includes(next) ? value : [...value, next])
      },
      collapse(input) {
        const next = expectString(input, "value")
        const match = items.find((item) => item.value === next)
        if (!match) {
          const known = items.map((item) => item.value)
          rejectState(
            `Section "${next}" is not available. Available sections: ${known.length ? known.join(", ") : "(none)"}.`,
          )
        }
        if (match.disabled) {
          rejectState(`Section "${next}" is disabled and cannot be collapsed.`)
        }
        setValue(value.filter((v) => v !== next))
      },
    },
  })

  const contextValue = React.useMemo<AccordionContextValue>(
    () => ({ rootDisabled: disabled, registerItem, describeItem }),
    [disabled, registerItem, describeItem],
  )

  if (isMultiple) {
    return (
      <AccordionContext.Provider value={contextValue}>
        <AccordionPrimitive.Root
          data-slot="accordion"
          type="multiple"
          disabled={disabled}
          value={value}
          onValueChange={setValue}
          {...props}
        />
      </AccordionContext.Provider>
    )
  }

  return (
    <AccordionContext.Provider value={contextValue}>
      <AccordionPrimitive.Root
        data-slot="accordion"
        type="single"
        disabled={disabled}
        value={value[0] ?? ""}
        onValueChange={(next: string) => setValue(next === "" ? [] : [next])}
        {...props}
      />
    </AccordionContext.Provider>
  )
}

function AccordionItem({
  className,
  value,
  disabled = false,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  const { rootDisabled, registerItem, describeItem } = useAccordionContext()
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const readLabel = useAccessibleNameResolver(triggerRef)
  const effectiveDisabled = disabled || rootDisabled

  // The resolver is registered with the item, so the entry can answer for its
  // label from the first commit it exists in. `disabled` still arrives through
  // describeItem, which runs in the same commit as this one and batches with
  // it — nothing can read between the two.
  React.useEffect(
    () => registerItem(value, readLabel),
    [registerItem, value, readLabel],
  )
  React.useEffect(
    () => describeItem(value, effectiveDisabled),
    [describeItem, value, effectiveDisabled],
  )

  const itemContextValue = React.useMemo<AccordionItemContextValue>(
    () => ({ triggerRef }),
    [],
  )

  return (
    <AccordionItemContext.Provider value={itemContextValue}>
      <AccordionPrimitive.Item
        data-slot="accordion-item"
        className={cn("border-b last:border-b-0", className)}
        value={value}
        disabled={disabled}
        {...props}
      />
    </AccordionItemContext.Provider>
  )
}

function AccordionTrigger({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  const itemContext = React.useContext(AccordionItemContext)
  const mergedRef = useMergedRef(ref, itemContext?.triggerRef)

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={mergedRef}
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
