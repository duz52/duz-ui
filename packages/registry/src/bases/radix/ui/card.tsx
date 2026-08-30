"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { readText } from "@/lib/agent-ui/agent-content"

/** Cap for each card field reported to an agent. */
const FIELD_MAX_LENGTH = 500

type CardContentState = {
  title: string | null
  description: string | null
  content: string | null
  footer: string | null
}

/**
 * Reads one card part out of the card's own subtree. A part that is not
 * rendered reads as null, so an agent can tell "empty" from "absent".
 */
function slotText(root: HTMLElement | null, selector: string): string | null {
  const element = root?.querySelector(selector)
  return element ? readText(element, FIELD_MAX_LENGTH) : null
}

function Card({
  className,
  size = "default",
  ref,
  agent,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  agent?: AgentProp
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(ref, rootRef)

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect.
  useCapability<CardContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: "Card",
    read: () => {
      const root = rootRef.current
      return {
        title: slotText(root, '[data-slot="card-title"]'),
        description: slotText(root, '[data-slot="card-description"]'),
        content: slotText(root, '[data-slot="card-content"]'),
        footer: slotText(root, '[data-slot="card-footer"]'),
      }
    },
    actions: {},
  })
  return (
    <div
      ref={mergedRef}
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
