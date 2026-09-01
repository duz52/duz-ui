"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/duz-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import { useMergedRef } from "@/lib/duz-ui/use-merged-ref"
import { readText } from "@/lib/duz-ui/agent-content"

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

/** Cap for the title reported as the card's label, matching agent-identity's name cap. */
const CARD_TITLE_MAX_LENGTH = 100

/**
 * The title is the part of a card a person reads first, so it is the name
 * discovery must carry. CardTitle resolves its own text and reports it
 * here; the root uses it as the capability's default label.
 */
interface CardTitleContextValue {
  setCardTitle: (label: string | null) => void
  /**
   * CardTitle attaches itself here. The root's own name lives in the
   * title's text, and the title is the part that stays mounted, so this is
   * what the root's id is derived from — read at registration, before the
   * reported label has made its way back through state.
   */
  nameRef: React.RefObject<HTMLElement | null>
}

const CardTitleContext = React.createContext<CardTitleContextValue | null>(null)

function useCardTitleContext(): CardTitleContextValue {
  const ctx = React.useContext(CardTitleContext)
  if (!ctx) {
    throw new Error("CardTitle must be rendered inside <Card>.")
  }
  return ctx
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

  // The title a person reads first is the name discovery carries; a card
  // without one keeps the generic "Card". CardTitle reports its own text;
  // the root holds it in state and ignores an unchanged report, so a
  // repeated report cannot loop.
  const [cardTitle, setCardTitle] = React.useState<string | null>(null)
  const nameRef = React.useRef<HTMLElement | null>(null)
  // A title's text is not an accessible name the way a button's is, so the
  // card reads it with the same readText that reports it, at registration
  // time; an absent or empty title leaves identity to the label.
  const identitySource = React.useCallback((): string | undefined => {
    const title = nameRef.current
    return title ? readText(title, CARD_TITLE_MAX_LENGTH) || undefined : undefined
  }, [nameRef])

  const reportCardTitle = React.useCallback((label: string | null) => {
    setCardTitle((prev) => (prev === label ? prev : label))
  }, [])

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect.
  const { id } = useCapability<CardContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: cardTitle ?? "Card",
    identitySource,
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

  const contextValue = React.useMemo<CardTitleContextValue>(
    () => ({ setCardTitle: reportCardTitle, nameRef }),
    [reportCardTitle],
  )

  return (
    // A chart or a panel rendered inside a card is part of that card. Without
    // this an agent reads the card as empty and the content beside it as
    // unrelated, and has no way to tell that one is inside the other.
    <AgentContainerProvider ownerId={id}>
      <CardTitleContext.Provider value={contextValue}>
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
      </CardTitleContext.Provider>
    </AgentContainerProvider>
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

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) {
  const { setCardTitle, nameRef } = useCardTitleContext()
  const elementRef = React.useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(ref, elementRef, nameRef)

  // The title is resolved in a layout effect on every commit, so a title
  // whose text changes follows; the root ignores a report equal to what it
  // already holds, so a repeated report cannot loop.
  React.useLayoutEffect(() => {
    setCardTitle(readText(elementRef.current, CARD_TITLE_MAX_LENGTH) || null)
  })

  return (
    <div
      data-slot="card-title"
      ref={mergedRef}
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
