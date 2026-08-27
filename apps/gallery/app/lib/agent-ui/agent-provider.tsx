"use client"

/**
 * Agent UI — provider that connects the capability registry to WebMCP.
 *
 * Runs `connectWebMCP(getCapabilityRegistry())` in a `useEffect` when enabled,
 * tears down on unmount. Renders children unchanged. No context, no state —
 * the registry is already the single index.
 */

import * as React from "react"
import { getCapabilityRegistry } from "./registry"
import { connectWebMCP } from "./webmcp"

export function AgentUIProvider({
  children,
  enabled = true,
}: {
  children?: React.ReactNode
  enabled?: boolean
}): React.ReactNode {
  const registry = getCapabilityRegistry()

  React.useEffect(() => {
    if (!enabled) return
    return connectWebMCP(registry)
  }, [enabled, registry])

  return children
}
