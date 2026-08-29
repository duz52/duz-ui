import assert from "node:assert/strict"
import test from "node:test"

import type { Capability, CapabilityResult } from "../src/lib/agent-ui/capability"
import { getCapabilityRegistry } from "../src/lib/agent-ui/registry"
import { createAgentTools, type AgentTool } from "../src/lib/agent-ui/tools"

/**
 * Spec sections 7 and 8: the adapter exposes a stable tool surface keyed by
 * capability kind, dispatches only through the registry, and never invents a
 * tool per component instance.
 */

const registry = getCapabilityRegistry()

function stub(options: {
  id: string
  kind: string
  label?: string
  actions: string[]
  state?: Record<string, unknown>
  onInvoke?: (action: string, input: unknown) => unknown
}): Capability {
  let state: Record<string, unknown> = options.state ?? { value: "a" }
  return {
    id: options.id,
    kind: options.kind,
    label: options.label,
    actions: options.actions,
    read: () => state,
    async invoke(action, input): Promise<CapabilityResult> {
      const detail = options.onInvoke?.(action, input)
      state = { ...state, lastAction: action, lastInput: input }
      return { state, detail }
    },
  }
}

function byName(tools: AgentTool[]): Map<string, AgentTool> {
  return new Map(tools.map((tool) => [tool.name, tool]))
}

test("discovery tools are always present and marked read-only", () => {
  const tools = byName(createAgentTools(registry))
  assert.deepEqual([...tools.keys()], ["ui_list", "ui_read"])
  assert.equal(tools.get("ui_list")?.annotations?.readOnlyHint, true)
  assert.equal(tools.get("ui_read")?.annotations?.readOnlyHint, true)
})

test("kind tools exist only while a capability of that kind is mounted", () => {
  const off = registry.register(
    stub({ id: "settings", kind: "tabs", label: "Settings", actions: ["select"] }),
  )

  assert.ok(byName(createAgentTools(registry)).has("tabs_select"))
  assert.equal(byName(createAgentTools(registry)).has("table_filter"), false)

  off()
  assert.equal(byName(createAgentTools(registry)).has("tabs_select"), false)
})

test("tool count scales with kinds, not with component instances", () => {
  const a = registry.register(stub({ id: "t1", kind: "tabs", actions: ["select"] }))
  const one = createAgentTools(registry).length
  const b = registry.register(stub({ id: "t2", kind: "tabs", actions: ["select"] }))
  const c = registry.register(stub({ id: "t3", kind: "tabs", actions: ["select"] }))

  assert.equal(createAgentTools(registry).length, one, "three tabs, one tabs tool")

  a()
  b()
  c()
})

test("ui_list reports every mounted capability", async () => {
  const off = registry.register(
    stub({
      id: "orders",
      kind: "data-table",
      label: "Orders",
      actions: ["filter", "sort", "select_rows", "set_page"],
    }),
  )
  const tools = byName(createAgentTools(registry))

  const output = JSON.parse(await tools.get("ui_list")!.execute({}))
  assert.deepEqual(output.state.capabilities, [
    {
      id: "orders",
      kind: "data-table",
      label: "Orders",
      actions: ["filter", "sort", "select_rows", "set_page"],
    },
  ])

  off()
})

test("a kind tool dispatches through the registry and returns canonical state", async () => {
  const seen: unknown[] = []
  const off = registry.register(
    stub({
      id: "settings",
      kind: "tabs",
      actions: ["select"],
      onInvoke: (action, input) => seen.push([action, input]),
    }),
  )
  const tools = byName(createAgentTools(registry))

  const output = JSON.parse(
    await tools.get("tabs_select")!.execute({ target: "settings", value: "billing" }),
  )

  // `target` is the adapter's routing key and never reaches the capability.
  assert.deepEqual(seen, [["select", { value: "billing" }]])
  assert.equal(output.ok, true)
  assert.equal(output.target, "settings")
  assert.equal(output.action, "select")
  assert.deepEqual(output.state.lastInput, { value: "billing" })

  off()
})

test("an unknown target is rejected with a message an agent can correct from", async () => {
  const off = registry.register(stub({ id: "settings", kind: "tabs", actions: ["select"] }))
  const tools = byName(createAgentTools(registry))

  // A refusal is returned, never thrown: Chrome's WebMCP discards a thrown
  // message, and these are written for the agent to read.
  for (const [name, input] of [
    ["tabs_select", { target: "nope", value: "x" }],
    ["ui_read", { target: "nope" }],
  ] as const) {
    const output = JSON.parse(await tools.get(name)!.execute(input))
    assert.equal(output.ok, false)
    assert.match(output.error.message, /Available ids: settings\./)
  }

  off()
})

test("a page bug surfaces as a neutral message, never as internals", async () => {
  const off = registry.register(
    stub({
      id: "settings",
      kind: "tabs",
      actions: ["select"],
      onInvoke: () => {
        throw new TypeError("Cannot read properties of undefined (reading 'setValue')")
      },
    }),
  )
  const tools = byName(createAgentTools(registry))

  const errors = console.error
  console.error = () => {}
  try {
    const output = JSON.parse(
      await tools.get("tabs_select")!.execute({ target: "settings", value: "x" }),
    )
    assert.equal(output.ok, false)
    assert.equal(output.error.code, "internal")
    assert.equal(output.error.message, 'The "tabs_select" tool could not complete.')
    assert.doesNotMatch(output.error.message, /setValue|TypeError|undefined/)
  } finally {
    console.error = errors
  }

  off()
})

test("every tool name fits the WebMCP charset and the 30 character budget", () => {
  const off = [
    registry.register(stub({ id: "a", kind: "tabs", actions: ["select"] })),
    registry.register(stub({ id: "b", kind: "select", actions: ["choose", "clear"] })),
    registry.register(stub({ id: "c", kind: "checkbox", actions: ["set"] })),
    registry.register(stub({ id: "d", kind: "dialog", actions: ["open", "close"] })),
    registry.register(stub({ id: "e", kind: "input", actions: ["set_value", "clear"] })),
    registry.register(
      stub({
        id: "f",
        kind: "data-table",
        actions: ["filter", "sort", "select_rows", "set_page", "set_column_visibility"],
      }),
    ),
    registry.register(
      stub({
        id: "refresh-orders",
        kind: "action",
        actions: ["run"],
        state: { description: "Refresh the current order list." },
      }),
    ),
  ]

  const tools = createAgentTools(registry)
  for (const tool of tools) {
    assert.match(tool.name, /^[A-Za-z0-9_.-]{1,30}$/, `bad tool name: ${tool.name}`)
    assert.ok(tool.description.length <= 500, `description too long: ${tool.name}`)
  }
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length, "names must be unique")

  for (const dispose of off) dispose()
})

test("an oversized result stays valid JSON and says it was truncated", async () => {
  const off = registry.register(
    stub({
      id: "orders",
      kind: "data-table",
      actions: ["filter"],
      state: { rows: Array.from({ length: 400 }, (_, index) => ({ id: `ORD-${index}` })) },
    }),
  )
  const tools = byName(createAgentTools(registry))

  const raw = await tools.get("ui_read")!.execute({ target: "orders" })
  const parsed = JSON.parse(raw)

  assert.ok(raw.length <= 1500)
  assert.equal(parsed.truncated, true)
  assert.match(parsed.reason, /tool output budget/)

  off()
})

test("a business action gets its own tool, bound to one capability", async () => {
  const seen: unknown[] = []
  const off = registry.register(
    stub({
      id: "refresh-orders",
      kind: "action",
      actions: ["run"],
      state: {
        description: "Refresh the current order list.",
        inputSchema: { scope: { type: "string" } },
        requiresConfirmation: false,
      },
      onInvoke: (action, input) => seen.push([action, input]),
    }),
  )
  const tool = byName(createAgentTools(registry)).get("action_refresh-orders")

  assert.ok(tool, "the business action must produce its own tool")
  assert.equal(tool.description, "Refresh the current order list.")
  // The tool name already identifies the action, so there is no `target`.
  assert.deepEqual(Object.keys(tool.inputSchema.properties), ["scope"])
  assert.equal(tool.annotations, undefined)

  await tool.execute({ scope: "page" })
  assert.deepEqual(seen, [["run", { scope: "page" }]])

  off()
})

test("a confirmed action advertises the confirmation argument", () => {
  const off = registry.register(
    stub({
      id: "delete-account",
      kind: "action",
      actions: ["run"],
      state: { description: "Permanently delete the account.", requiresConfirmation: true },
    }),
  )
  const tool = byName(createAgentTools(registry)).get("action_delete-account")

  assert.ok(tool)
  assert.deepEqual(tool.inputSchema.required, ["confirmed"])
  assert.equal(
    (tool.inputSchema.properties.confirmed as { type: string }).type,
    "boolean",
  )

  off()
})

test("no tool exists for a component kind Agent UI does not support", () => {
  const off = registry.register(stub({ id: "x", kind: "carousel", actions: ["next"] }))
  const names = createAgentTools(registry).map((tool) => tool.name)

  assert.deepEqual(names, ["ui_list", "ui_read"], "unsupported kinds expose nothing")

  off()
})

test("every tool declares what it acts on", () => {
  const off = registry.register(
    stub({ id: "settings", kind: "tabs", label: "Settings", actions: ["select"] }),
  )
  const tools = byName(createAgentTools(registry))

  assert.deepEqual(tools.get("ui_list")?.scope, { on: "page" })
  assert.deepEqual(tools.get("ui_read")?.scope, { on: "any-capability" })
  assert.deepEqual(tools.get("tabs_select")?.scope, {
    on: "kind",
    kind: "tabs",
    action: "select",
  })

  // A tool that takes a target says so in its schema; a page tool does not.
  assert.equal("target" in (tools.get("tabs_select")?.inputSchema.properties ?? {}), true)
  assert.equal("target" in (tools.get("ui_list")?.inputSchema.properties ?? {}), false)

  off()
})

test("a business action tool is scoped to the one capability it runs", () => {
  const off = registry.register(
    stub({
      id: "refresh-orders",
      kind: "action",
      actions: ["run"],
      state: { description: "Refresh the orders list.", requiresConfirmation: false },
    }),
  )

  const tool = byName(createAgentTools(registry)).get("action_refresh-orders")
  assert.deepEqual(tool?.scope, { on: "capability", id: "refresh-orders" })

  off()
})
