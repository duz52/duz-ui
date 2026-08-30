"use client"

import * as React from "react"
import { Toaster as SonnerToaster, type ToasterProps } from "sonner"

import { readText } from "@/lib/agent-ui/agent-content"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"

/** Caps for the text reported for a toast's title and description. */
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 500

/**
 * The recent log is bounded at 20 toasts, oldest dropped. This is a hard
 * contract: nothing here may grow with history — however long the page has
 * been open, however many toasts were raised, the log costs a constant
 * amount of memory and a constant amount of work per toast.
 */
const RECENT_LOG_LIMIT = 20

const TOAST_SELECTOR = '[data-sonner-toast]'
const TITLE_SELECTOR = '[data-title]'
const DESCRIPTION_SELECTOR = '[data-description]'

// DOM node type constant, spelled out like in `agent-content`: `Node` is not
// a global in every environment these components are read in.
const ELEMENT_NODE = 1

export interface Notification {
  title: string
  description: string | null
  /** Sonner's own type when the element exposes one; otherwise "message". */
  kind: string
  /** ISO timestamp of when the toaster first observed the toast. */
  at: string
}

/** One observed toast: the element plus the notification captured from it. */
interface RecentEntry {
  element: HTMLElement
  notification: Notification
}

/** Reads one toast's reported shape out of its own element. */
function readNotification(toast: HTMLElement, at: string): Notification {
  const descriptionElement = toast.querySelector<HTMLElement>(DESCRIPTION_SELECTOR)
  return {
    title: readText(toast.querySelector<HTMLElement>(TITLE_SELECTOR), TITLE_MAX_LENGTH),
    // Absent reads as null, not a missing key: an agent must be able to tell
    // "no description" from a description that happens to be empty.
    description: descriptionElement
      ? readText(descriptionElement, DESCRIPTION_MAX_LENGTH)
      : null,
    kind: toast.dataset.type ?? "message",
    at,
  }
}

type ToasterContentState = {
  visible: Notification[]
  recent: Notification[]
}

/**
 * The toaster is the page's answer to "did my action do anything": the
 * notifications the application raised. `read()` reports what is on screen
 * (pulled from the DOM at read time, like every other content capability)
 * and what was raised recently — a toast is gone in seconds, so an agent
 * that acts and then reads must not have its answer depend on timing.
 *
 * `recent` is captured by a MutationObserver scoped to the toaster's own
 * container, observing child additions only — never a document-wide scan,
 * never a polling loop. The observer is created in an effect and
 * disconnected on unmount. A toast that is still visible appears in both
 * lists with the same `at`, because `visible` reuses the entry the observer
 * captured.
 */
export function Toaster({
  agent,
  ref,
  ...props
}: ToasterProps & {
  agent?: AgentProp
  ref?: React.Ref<HTMLElement>
}) {
  const containerRef = React.useRef<HTMLElement>(null)
  const mergedRef = useMergedRef(ref, containerRef)
  // The bounded log of observed toasts. A ref, not state: the observer writes
  // it, and a read answers from it — nothing here needs to re-render.
  const recentRef = React.useRef<RecentEntry[]>([])

  // `agent={false}` registers nothing, and nothing will ever read, so there
  // is no reason to pay for the observer either.
  const enabled = agent !== false

  // The container is the section sonner renders (its forwarded ref), which
  // exists as soon as the component mounts — toasts live in its subtree, so
  // child additions anywhere under it are new toasts.
  React.useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== ELEMENT_NODE) continue
          const element = node as Element
          const toasts = element.matches(TOAST_SELECTOR)
            ? [element]
            : Array.from(element.querySelectorAll(TOAST_SELECTOR))
          for (const toast of toasts) {
            const toastElement = toast as HTMLElement
            // A re-inserted toast keeps the `at` it was first observed with,
            // never a second capture.
            if (recentRef.current.some((entry) => entry.element === toastElement)) {
              continue
            }
            recentRef.current.push({
              element: toastElement,
              notification: readNotification(toastElement, new Date().toISOString()),
            })
            if (recentRef.current.length > RECENT_LOG_LIMIT) {
              recentRef.current.splice(0, recentRef.current.length - RECENT_LOG_LIMIT)
            }
          }
        }
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [enabled])

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect.
  useCapability<ToasterContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: "Notifications",
    read: () => {
      const container = containerRef.current
      const visible: Notification[] = []
      if (container) {
        for (const toast of container.querySelectorAll(TOAST_SELECTOR)) {
          const toastElement = toast as HTMLElement
          const logged = recentRef.current.find(
            (entry) => entry.element === toastElement,
          )
          // A toast still on screen reports the entry the observer captured,
          // so `visible` and `recent` agree on its `at`; one that slipped
          // through is read live.
          visible.push(
            logged
              ? logged.notification
              : readNotification(toastElement, new Date().toISOString()),
          )
        }
      }
      return {
        visible,
        recent: recentRef.current.map((entry) => entry.notification),
      }
    },
    actions: {},
  })

  return (
    <SonnerToaster
      ref={mergedRef}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}
