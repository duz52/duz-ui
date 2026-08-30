import assert from "node:assert/strict"
import test from "node:test"

import type { Capability, CapabilityResult } from "../src/lib/agent-ui/capability"
import { getCapabilityRegistry } from "../src/lib/agent-ui/registry"
import { createAgentTools, digest, type AgentTool } from "../src/lib/agent-ui/tools"

/**
 * The adapter exposes a stable tool surface keyed by capability kind,
 * dispatches only through the registry, and never invents a tool per
 * component instance. `ui_list` returns the page as a document — structure
 * and current state together — and degrades honestly when the document
 * exceeds the output budget: structure first, then states, then elements.
 */

const registry = getCapabilityRegistry()

function stub(options: {
  id: string
  kind: string
  label?: string
  description?: string
  owner?: string
  actions: string[]
  state?: Record<string, unknown>
  summarise?: () => string
  onInvoke?: (action: string, input: unknown) => unknown
}): Capability {
  let state: Record<string, unknown> = options.state ?? { value: "a" }
  return {
    id: options.id,
    kind: options.kind,
    label: options.label,
    description: options.description,
    owner: options.owner,
    actions: options.actions,
    read: () => state,
    summarise: options.summarise,
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

// — digest —

test("digest keeps scalars as-is and cuts long strings", () => {
  assert.deepEqual(digest({ open: false, count: 3, nothing: null }), {
    open: false,
    count: 3,
    nothing: null,
  })

  const note = "x".repeat(200)
  const cut = digest({ note }).note as string
  assert.equal(cut.length, 81, "80 characters plus the ellipsis")
  assert.equal(cut.slice(0, 80), "x".repeat(80))
  assert.ok(cut.endsWith("…"))
})

test("digest replaces bulky arrays and objects with counts and keeps small scalar arrays", () => {
  assert.deepEqual(digest({ rows: [{ id: 1 }, { id: 2 }] }), { rows: { items: 2 } })
  assert.deepEqual(digest({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9] }), {
    values: { items: 9 },
  })
  assert.deepEqual(digest({ values: [1, 2, 3, 4, 5, 6, 7, 8] }), {
    values: [1, 2, 3, 4, 5, 6, 7, 8],
  })
  assert.deepEqual(digest({ options: ["a", "b", "c"] }), { options: ["a", "b", "c"] })
  assert.deepEqual(digest({ meta: { a: 1, b: 2, c: 3 } }), { meta: { fields: 3 } })

  // Key order is preserved.
  assert.deepEqual(Object.keys(digest({ z: 1, a: 2, m: 3 })), ["z", "a", "m"])
})

// — tool surface —

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

test("button_press exists only while a button capability is mounted and dispatches press to the right target", async () => {
  const seen: unknown[] = []
  const off = registry.register(
    stub({
      id: "invite",
      kind: "button",
      label: "Send Invitation",
      actions: ["press"],
      onInvoke: (action, input) => seen.push([action, input]),
    }),
  )

  assert.ok(byName(createAgentTools(registry)).has("button_press"))

  const output = JSON.parse(
    await byName(createAgentTools(registry)).get("button_press")!.execute({
      target: "invite",
    }),
  )
  assert.equal(output.ok, true)
  assert.equal(output.target, "invite")
  assert.equal(output.action, "press")
  assert.deepEqual(seen, [["press", {}]], "press dispatches to the named target alone")

  off()
  assert.equal(byName(createAgentTools(registry)).has("button_press"), false)
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

test("ui_list returns the page document with every element's current state", async () => {
  const off = registry.register(
    stub({
      id: "orders",
      kind: "data-table",
      label: "Orders",
      actions: ["filter", "sort", "select_rows", "set_page"],
      state: { page: 2, filtered: false },
    }),
  )

  const output = JSON.parse(await byName(createAgentTools(registry)).get("ui_list")!.execute({}))
  assert.equal(output.ok, true)
  assert.equal(output.action, "list")
  assert.deepEqual(output.elements, [
    {
      id: "orders",
      kind: "data-table",
      label: "Orders",
      actions: ["filter", "sort", "select_rows", "set_page"],
      state: { page: 2, filtered: false },
    },
  ])
  assert.equal("page" in output, false, "no page header without a page capability")

  off()
})

test("ui_list nests an element under the capability its owner names, and a dangling owner still appears as a root", async () => {
  const dispose = [
    registry.register(stub({ id: "panel", kind: "tabs", label: "Panel", actions: ["select"] })),
    registry.register(
      stub({ id: "rows", kind: "data-table", label: "Rows", actions: ["filter"], owner: "panel" }),
    ),
    registry.register(
      stub({
        id: "ghosted",
        kind: "input",
        label: "Ghosted",
        actions: ["set_value"],
        owner: "missing",
      }),
    ),
  ]

  const output = JSON.parse(await byName(createAgentTools(registry)).get("ui_list")!.execute({}))
  assert.deepEqual(output.elements, [
    {
      id: "panel",
      kind: "tabs",
      label: "Panel",
      actions: ["select"],
      state: { value: "a" },
      children: [
        {
          id: "rows",
          kind: "data-table",
          label: "Rows",
          actions: ["filter"],
          state: { value: "a" },
        },
      ],
    },
    {
      id: "ghosted",
      kind: "input",
      label: "Ghosted",
      actions: ["set_value"],
      state: { value: "a" },
    },
  ])

  for (const off of dispose) off()
})

test("ui_list promotes a page capability into the page header and does not list it", async () => {
  const dispose = [
    registry.register(
      stub({ id: "admin", kind: "page", label: "Admin", description: "Manage the store." }),
    ),
    registry.register(stub({ id: "table", kind: "data-table", label: "Orders", actions: ["filter"] })),
  ]

  const output = JSON.parse(await byName(createAgentTools(registry)).get("ui_list")!.execute({}))
  assert.deepEqual(output.page, { title: "Admin", description: "Manage the store." })
  assert.deepEqual(
    output.elements.map((element: { id: string }) => element.id),
    ["table"],
  )

  for (const off of dispose) off()
})

test("ui_list uses the component's own summary when it provides one", async () => {
  const off = registry.register(
    stub({
      id: "wizard",
      kind: "tabs",
      label: "Wizard",
      actions: ["select"],
      summarise: () => "step 2 of 4",
    }),
  )

  const output = JSON.parse(await byName(createAgentTools(registry)).get("ui_list")!.execute({}))
  assert.equal(output.elements[0].state, "step 2 of 4")

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

test("an oversized read with no list to window is refused with a message that names the tool", async () => {
  const off = registry.register(
    stub({
      id: "orders",
      kind: "data-table",
      actions: ["filter"],
      state: { page: 1, note: "x".repeat(9000) },
    }),
  )
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(await tools.get("ui_read")!.execute({ target: "orders" }))

  assert.equal(parsed.ok, false)
  assert.equal(parsed.error.code, "output_too_large")
  assert.match(parsed.error.message, /ui_read/)
  assert.match(parsed.error.message, /[Nn]arrow/)

  off()
})

test("a state that is bulky but within budget is returned whole", async () => {
  const off = registry.register(
    stub({
      id: "small-table",
      kind: "data-table",
      actions: ["filter"],
      state: {
        page: 1,
        rows: Array.from({ length: 8 }, (_, index) => ({
          id: `ORD-${index}`,
          cells: { customer: "Northwind Traders", status: "pending", total: 642.5 },
        })),
      },
    }),
  )
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(
    await tools.get("ui_read")!.execute({ target: "small-table" }),
  )
  assert.equal(parsed.state.rows.length, 8)
  assert.equal("window" in parsed, false, "a whole state does not grow a window key")

  off()
})

// — windowing an over-budget read —

/** A data-table whose state is `rows` of compact entries, for windowing tests. */
function rowTable(id: string, rows: number): Capability {
  return stub({
    id,
    kind: "data-table",
    actions: ["filter"],
    state: {
      page: 1,
      rows: Array.from({ length: rows }, (_, index) => ({
        id: `ORD-${index}`,
        status: "pending",
      })),
    },
  })
}

test("an over-budget read windows the largest array and reports the true total", async () => {
  const off = registry.register(rowTable("orders", 500))
  const tools = byName(createAgentTools(registry))

  const raw = await tools.get("ui_read")!.execute({ target: "orders" })
  const parsed = JSON.parse(raw)

  assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.action, "read")
  assert.ok(parsed.state.rows.length < 500, "the rows came back windowed")
  assert.deepEqual(parsed.window, {
    field: "rows",
    offset: 0,
    returned: parsed.state.rows.length,
    total: 500,
  })

  off()
})

test("an offset returns the tail of the list and reports where it starts", async () => {
  const off = registry.register(rowTable("orders", 500))
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(
    await tools.get("ui_read")!.execute({ target: "orders", offset: 400 }),
  )

  assert.equal(parsed.state.rows.length, 100)
  assert.equal(parsed.state.rows[0].id, "ORD-400")
  assert.deepEqual(parsed.window, {
    field: "rows",
    offset: 400,
    returned: 100,
    total: 500,
  })

  off()
})

test("an offset past the end returns an empty window and the true total", async () => {
  const off = registry.register(rowTable("orders", 500))
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(
    await tools.get("ui_read")!.execute({ target: "orders", offset: 999 }),
  )

  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.state.rows, [])
  assert.deepEqual(parsed.window, {
    field: "rows",
    offset: 500,
    returned: 0,
    total: 500,
  })

  off()
})

test("an explicit limit is honoured exactly", async () => {
  const off = registry.register(rowTable("orders", 500))
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(
    await tools.get("ui_read")!.execute({ target: "orders", limit: 10 }),
  )

  assert.equal(parsed.state.rows.length, 10)
  assert.deepEqual(parsed.window, {
    field: "rows",
    offset: 0,
    returned: 10,
    total: 500,
  })

  off()
})

test("a single entry that cannot fit even alone is refused, naming the field", async () => {
  const off = registry.register(
    stub({
      id: "orders",
      kind: "data-table",
      actions: ["filter"],
      state: {
        note: "context ".repeat(900),
        rows: Array.from({ length: 5 }, (_, index) => ({
          id: `ORD-${index}`,
          cells: { customer: "Northwind Traders Limited".repeat(60) },
        })),
      },
    }),
  )
  const tools = byName(createAgentTools(registry))

  const parsed = JSON.parse(await tools.get("ui_read")!.execute({ target: "orders" }))

  assert.equal(parsed.ok, false)
  assert.equal(parsed.error.code, "output_too_large")
  assert.match(parsed.error.message, /rows/)

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

// — honest degradation of an over-budget listing —

test("an over-budget listing first drops grandchildren and marks each dropped-from parent", async () => {
  const label = "Child section ".repeat(6)
  const grandchildLabel = "Grandchild section ".repeat(6)
  const dispose: (() => void)[] = []
  try {
    dispose.push(
      registry.register(stub({ id: "root", kind: "tabs", label: "Root", actions: ["select"] })),
    )
    for (let c = 0; c < 30; c++) {
      dispose.push(
        registry.register(
          stub({ id: `child-${c}`, kind: "input", label, actions: ["set_value"], owner: "root" }),
        ),
      )
      for (let g = 0; g < 8; g++) {
        dispose.push(
          registry.register(
            stub({
              id: `grandchild-${c}-${g}`,
              kind: "input",
              label: grandchildLabel,
              actions: ["set_value"],
              owner: `child-${c}`,
            }),
          ),
        )
      }
    }

    const raw = await byName(createAgentTools(registry)).get("ui_list")!.execute({})
    const parsed = JSON.parse(raw)

    assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
    assert.equal(parsed.elements.length, 1)
    const root = parsed.elements[0]
    assert.equal(root.children.length, 30, "each root keeps its own children")
    for (const child of root.children) {
      assert.equal(child.childrenOmitted, 8)
      assert.equal("children" in child, false)
    }
    assert.equal("truncated" in parsed, false)
    assert.equal(raw.includes("grandchild-"), false, "grandchildren are gone entirely")
  } finally {
    for (const off of dispose) off()
  }
})

test("an over-budget listing then drops every remaining children array", async () => {
  const label = "Child section ".repeat(8)
  const dispose: (() => void)[] = []
  try {
    dispose.push(
      registry.register(stub({ id: "root", kind: "tabs", label: "Root", actions: ["select"] })),
    )
    for (let c = 0; c < 200; c++) {
      dispose.push(
        registry.register(
          stub({ id: `child-${c}`, kind: "input", label, actions: ["set_value"], owner: "root" }),
        ),
      )
      dispose.push(
        registry.register(
          stub({
            id: `grandchild-${c}`,
            kind: "input",
            label: "G",
            actions: ["set_value"],
            owner: `child-${c}`,
          }),
        ),
      )
    }

    const raw = await byName(createAgentTools(registry)).get("ui_list")!.execute({})
    const parsed = JSON.parse(raw)

    assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
    assert.equal(parsed.elements.length, 1)
    const root = parsed.elements[0]
    assert.equal(root.childrenOmitted, 200)
    assert.equal("children" in root, false)
    assert.equal("truncated" in parsed, false)
    assert.equal(raw.includes("Child section"), false)
  } finally {
    for (const off of dispose) off()
  }
})

test("an over-budget listing then drops every state", async () => {
  const wideState = Object.fromEntries(
    Array.from({ length: 200 }, (_, index) => [`field-${index}`, "some value"]),
  )
  const dispose: (() => void)[] = []
  try {
    for (let i = 0; i < 10; i++) {
      dispose.push(
        registry.register(
          stub({
            id: `wide-${i}`,
            kind: "input",
            label: `Wide ${i}`,
            actions: ["set_value"],
            state: wideState,
          }),
        ),
      )
    }

    const raw = await byName(createAgentTools(registry)).get("ui_list")!.execute({})
    const parsed = JSON.parse(raw)

    assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
    assert.equal(parsed.elements.length, 10)
    for (const element of parsed.elements) {
      assert.equal("state" in element, false)
      assert.equal("children" in element, false)
    }
    assert.equal("truncated" in parsed, false)
    assert.equal(raw.includes("some value"), false)
  } finally {
    for (const off of dispose) off()
  }
})

test("an over-budget listing then drops every description", async () => {
  const description = "Element description text. ".repeat(20)
  const dispose: (() => void)[] = []
  try {
    for (let i = 0; i < 20; i++) {
      dispose.push(
        registry.register(
          stub({
            id: `described-${i}`,
            kind: "input",
            label: `Described ${i}`,
            description,
            actions: ["set_value"],
          }),
        ),
      )
    }

    const raw = await byName(createAgentTools(registry)).get("ui_list")!.execute({})
    const parsed = JSON.parse(raw)

    assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
    assert.equal(parsed.elements.length, 20)
    for (const element of parsed.elements) {
      assert.equal("description" in element, false)
      assert.equal("state" in element, false, "earlier steps stay applied")
    }
    assert.equal("truncated" in parsed, false)
    assert.equal(raw.includes("Element description"), false)
  } finally {
    for (const off of dispose) off()
  }
})

test("an over-budget listing finally keeps the first roots that fit and reports the truncation", async () => {
  const dispose: (() => void)[] = []
  try {
    for (let i = 0; i < 300; i++) {
      dispose.push(
        registry.register(stub({ id: `element-${i}`, kind: "input", actions: ["set_value"] })),
      )
    }

    const raw = await byName(createAgentTools(registry)).get("ui_list")!.execute({})
    const parsed = JSON.parse(raw)

    assert.ok(raw.length <= 8000, `result was ${raw.length} characters`)
    assert.deepEqual(parsed.truncated, { shown: parsed.elements.length, total: 300 })
    assert.ok(parsed.elements.length >= 1, "at least one element is always listed")
    assert.equal(parsed.elements[0].id, "element-0", "the first roots are kept")
    // Everything that can be shed has been shed by the time truncation happens.
    for (const element of parsed.elements) {
      assert.equal("state" in element, false)
      assert.equal("description" in element, false)
      assert.equal("children" in element, false)
    }
  } finally {
    for (const off of dispose) off()
  }
})
