"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

interface TabEntry {
  value: string
  label?: string
}

/**
 * Triggers only need to announce themselves. The active value is owned by
 * the Tabs wrapper, so nothing is duplicated into this context.
 */
interface TabsContextValue {
  /** Mount and unmount only. Presentation never affects registration order. */
  registerTab: (value: string) => () => void
  describeTab: (value: string, label: string | undefined) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error("TabsTrigger must be rendered inside <Tabs>.")
  }
  return ctx
}

type TabsState = {
  value: string
  tabs: { value: string; label?: string }[]
}

type TabsActions = {
  select: { value: string }
}

// Base UI types tab values as `any`; the capability contract requires
// strings, so the wrapper re-narrows what the library leaves open.
type TabsProps = Omit<
  TabsPrimitive.Root.Props,
  "value" | "defaultValue" | "onValueChange" | "className"
> & {
  value?: string
  defaultValue?: string
  // Arity 1 in both bases — Base UI's eventDetails stops at the wrapper.
  onValueChange?: (value: string) => void
  className?: string
  agent?: AgentProp
}

function Tabs({
  className,
  orientation = "horizontal",
  value: valueProp,
  defaultValue,
  onValueChange,
  agent,
  ...props
}: TabsProps) {
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  })

  const [tabs, setTabs] = React.useState<TabEntry[]>([])

  // Registration owns order, so it depends on the tab's value alone. A label
  // is presentation: changing one updates the entry in place rather than
  // removing and re-appending it, which would reorder what the agent reads.
  const registerTab = React.useCallback((value: string): (() => void) => {
    setTabs((prev) =>
      prev.some((tab) => tab.value === value) ? prev : [...prev, { value }],
    )
    return () => {
      setTabs((prev) => prev.filter((tab) => tab.value !== value))
    }
  }, [])

  const describeTab = React.useCallback(
    (value: string, label: string | undefined) => {
      setTabs((prev) => {
        const index = prev.findIndex((tab) => tab.value === value)
        if (index === -1 || prev[index]?.label === label) return prev
        const next = [...prev]
        next[index] = { value, label }
        return next
      })
    },
    [],
  )

  useCapability<TabsState, TabsActions>({
    agent,
    kind: "tabs",
    defaultLabel: "Tabs",
    read: () => ({
      value,
      tabs: tabs.map((t) => ({ value: t.value, label: t.label })),
    }),
    actions: {
      select(input) {
        const next = expectString(input, "value")
        const known = tabs.map((t) => t.value)
        if (!known.includes(next)) {
          rejectState(
            `Tab "${next}" is not available. Available tabs: ${known.length ? known.join(", ") : "(none)"}.`,
          )
        }
        setValue(next)
      },
    },
  })

  const contextValue = React.useMemo<TabsContextValue>(
    () => ({ registerTab, describeTab }),
    [registerTab, describeTab],
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        orientation={orientation}
        value={value}
        onValueChange={(next) => setValue(next)}
        className={cn(
          "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
          className,
        )}
        {...props}
      />
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: Omit<TabsPrimitive.List.Props, "className"> &
  VariantProps<typeof tabsListVariants> & {
    className?: string
  }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: Omit<TabsPrimitive.Tab.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  const { registerTab, describeTab } = useTabsContext()
  const label = typeof children === "string" ? children : undefined

  React.useEffect(() => registerTab(value), [registerTab, value])
  React.useEffect(() => describeTab(value, label), [describeTab, value, label])

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      value={value}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

function TabsContent({
  className,
  ...props
}: Omit<TabsPrimitive.Panel.Props, "value" | "className"> & {
  value: string
  className?: string
}) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
