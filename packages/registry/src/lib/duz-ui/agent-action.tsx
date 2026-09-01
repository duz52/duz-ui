"use client"

/**
 * Duz UI — explicit business action wrapper.
 *
 * Generic buttons do not automatically become callable agent actions (spec
 * section 6: business semantics are never inferred from presentation).
 * `AgentAction` registers a capability of kind `"action"` that the WebMCP
 * adapter exposes as a dedicated tool. It is a semantics wrapper, not a UI
 * element — it renders its children unchanged.
 */

import * as React from "react"
import type { CapabilityState } from "./capability"
import { useCapability, type ActionMap } from "./use-capability"
import { expectBoolean, rejectState } from "./validate"

/**
 * The WebMCP tool for a business action is named `action_<id>`. Chrome caps a
 * tool name at 30 characters, so the id is capped at 23 and restricted to the
 * WebMCP name charset. Truncating silently could collide with another action
 * and make its registration fail, so an invalid id is refused instead.
 */
const ACTION_ID = /^[A-Za-z0-9_.-]{1,23}$/

export interface AgentActionProps {
  id: string
  description: string
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
  /** JSON Schema `properties` for the action's own arguments. */
  inputSchema?: Record<string, unknown>
  /**
   * Consequential actions opt into confirmation. The agent must then pass
   * `confirmed: true`; anything else is rejected with this message.
   */
  confirm?: string
  children?: React.ReactNode
}

interface ActionState extends CapabilityState {
  description: string
  inputSchema?: Record<string, unknown>
  requiresConfirmation: boolean
  lastResult: unknown
}

type ActionActions = { run: Record<string, unknown> }

export function AgentAction(props: AgentActionProps): React.ReactNode {
  const { id, description, execute, inputSchema, confirm, children } = props

  if (!ACTION_ID.test(id)) {
    throw new Error(
      `Duz UI: AgentAction id "${id}" is invalid. Use 1-23 characters from A-Z, a-z, 0-9, "_", "-" or ".".`,
    )
  }

  // Held in a ref and surfaced only through `read()`, so React state remains
  // canonical and the registry never stores a second copy.
  const lastResultRef = React.useRef<unknown>(undefined)

  const read = React.useCallback((): ActionState => {
    return {
      description,
      inputSchema,
      requiresConfirmation: confirm !== undefined,
      lastResult: lastResultRef.current,
    }
  }, [description, inputSchema, confirm])

  const actions = React.useMemo<ActionMap<ActionActions>>(
    () => ({
      async run(input: Record<string, unknown>): Promise<unknown> {
        let payload: Record<string, unknown> = input
        if (confirm !== undefined) {
          const confirmed = expectBoolean(input, "confirmed")
          if (!confirmed) {
            rejectState(confirm)
          }
          payload = { ...input }
          delete payload.confirmed
        }
        const result = await execute(payload)
        lastResultRef.current = result
        return result
      },
    }),
    [execute, confirm],
  )

  useCapability<ActionState, ActionActions>({
    agent: { id, label: id },
    kind: "action",
    read,
    actions,
  })

  return children
}
