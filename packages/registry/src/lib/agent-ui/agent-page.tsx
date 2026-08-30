"use client"

/**
 * Agent UI — page identity.
 *
 * A person knows what a page is for before reading a single control: the
 * heading says "User List", the subheading says what it manages. An agent gets
 * a list of elements and has to infer the page from their shapes. Asked what
 * it had landed on, a blind operator answered by recognising the KPI card
 * titles — a guess that happened to be right.
 *
 * `AgentPage` is how a page says what it is. It registers a capability of kind
 * `"page"`, which `ui_list` promotes into the document's `page` field instead
 * of listing as an element: it is the header of the document, not a thing on
 * it. It renders nothing, so it can be dropped anywhere in the route.
 */

import * as React from "react"

import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"

export interface AgentPageProps {
  /** What this page is, as its heading says it. */
  title: string
  /** What a person does here, in one sentence. */
  description?: string
  agent?: AgentProp
}

type AgentPageState = {
  title: string
  description: string | null
  /** Where the page is, so an agent that followed a redirect knows where it landed. */
  path: string | null
}

export function AgentPage({ title, description, agent }: AgentPageProps): null {
  // Read pull-based, when an agent asks. The path is a fact the document owns;
  // reporting it costs nothing and saves an agent inferring where it is.
  useCapability<AgentPageState, Record<string, never>>({
    agent,
    kind: "page",
    defaultLabel: title,
    description,
    read: () => ({
      title,
      description: description ?? null,
      // `window.location`, not the bare global: a host may install the
      // document without installing every global that a browser also has.
      path: typeof window === "undefined" ? null : window.location.pathname,
    }),
    actions: {},
  })

  return null
}
