"use client"

/**
 * Duz UI - React view of the live capability registry.
 *
 * The registry owns the snapshot, so this hook is a direct
 * `useSyncExternalStore` over it. Caching the snapshot here instead would go
 * stale whenever the registry changed while no component was subscribed.
 */

import * as React from "react"

import type { CapabilityDescriptor } from "./capability"
import { getCapabilityRegistry } from "./registry"

/** No capabilities exist during SSR: nothing has mounted yet. */
const SERVER_SNAPSHOT: CapabilityDescriptor[] = []

export function useCapabilities(): CapabilityDescriptor[] {
  const registry = getCapabilityRegistry()

  return React.useSyncExternalStore(
    registry.subscribe,
    registry.describeAll,
    () => SERVER_SNAPSHOT,
  )
}
