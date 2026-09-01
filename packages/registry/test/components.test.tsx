import assert from "node:assert/strict"
import test, { before } from "node:test"

import { JSDOM } from "jsdom"

/**
 * Drives the real shipped components, not stubs: the same files the CLI
 * installs. This is what proves a binding actually reaches component state,
 * that the WebMCP tool surface appears for a mounted component, and that the
 * data table's security boundary holds.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://duz-ui.test/",
  pretendToBeVisual: true,
})

const globals = globalThis as Record<string, unknown>
globals["window"] = dom.window
globals["document"] = dom.window.document
globals["HTMLElement"] = dom.window.HTMLElement
globals["HTMLInputElement"] = dom.window.HTMLInputElement
globals["HTMLFormElement"] = dom.window.HTMLFormElement
globals["Event"] = dom.window.Event
globals["MouseEvent"] = dom.window.MouseEvent
globals["Node"] = dom.window.Node
globals["DOMRect"] = dom.window.DOMRect
globals["getComputedStyle"] = dom.window.getComputedStyle.bind(dom.window)
globals["requestAnimationFrame"] = (callback: FrameRequestCallback) =>
  dom.window.setTimeout(() => callback(Date.now()), 0) as unknown as number
globals["cancelAnimationFrame"] = (handle: number) => dom.window.clearTimeout(handle)
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
})

// Radix primitives ask for these; jsdom does not implement them. They are part
// of the test host, not of Duz UI.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globals["ResizeObserver"] = ResizeObserverStub
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
if (!dom.window.matchMedia) {
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

let React: typeof import("react")
let createRoot: typeof import("react-dom/client").createRoot
let registry: import("../src/lib/duz-ui/registry").CapabilityRegistry
let createAgentTools: typeof import("../src/lib/duz-ui/tools").createAgentTools
let Tabs: typeof import("../src/bases/radix/ui/tabs")
let Checkbox: typeof import("../src/bases/radix/ui/checkbox")
let Input: typeof import("../src/bases/radix/ui/input")
let DataTable: typeof import("../src/bases/radix/ui/data-table")
let Collapsible: typeof import("../src/bases/radix/ui/collapsible")
let Switch: typeof import("../src/bases/radix/ui/switch")
let Textarea: typeof import("../src/bases/radix/ui/textarea")

before(async () => {
  React = await import("react")
  ;({ createRoot } = await import("react-dom/client"))
  const registryModule = await import("../src/lib/duz-ui/registry")
  registry = registryModule.getCapabilityRegistry()
  ;({ createAgentTools } = await import("../src/lib/duz-ui/tools"))
  Tabs = await import("../src/bases/radix/ui/tabs")
  Checkbox = await import("../src/bases/radix/ui/checkbox")
  Input = await import("../src/bases/radix/ui/input")
  DataTable = await import("../src/bases/radix/ui/data-table")
  Collapsible = await import("../src/bases/radix/ui/collapsible")
  Switch = await import("../src/bases/radix/ui/switch")
  Textarea = await import("../src/bases/radix/ui/textarea")
})

async function withAct<T>(fn: () => Promise<T>): Promise<T> {
  globals["IS_REACT_ACT_ENVIRONMENT"] = true
  try {
    return await React.act(fn)
  } finally {
    globals["IS_REACT_ACT_ENVIRONMENT"] = false
  }
}

async function mount(element: React.ReactElement) {
  const container = dom.window.document.createElement("div")
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  await withAct(async () => {
    root.render(element)
  })
  return {
    container,
    async unmount() {
      await withAct(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function tool(name: string) {
  const found = createAgentTools(registry).find((candidate) => candidate.name === name)
  assert.ok(found, `expected the "${name}" tool to exist`)
  return found
}

/**
 * A tool refusal travels in the returned result, not as a thrown error:
 * Chrome's WebMCP discards a thrown message. Returns the refusal text so the
 * caller can assert on the wording the agent actually reads.
 */
async function refusalOf(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const output = JSON.parse(await tool(name).execute(input))
  assert.equal(output.ok, false, `expected "${name}" to refuse`)
  return output.error.message
}

test("a mounted Tabs registers a capability and tabs_select drives it", async () => {
  const { Tabs: Root, TabsList, TabsTrigger, TabsContent } = Tabs
  const tree = await mount(
    React.createElement(
      Root,
      { agent: { id: "settings", label: "Settings" }, defaultValue: "account" },
      React.createElement(
        TabsList,
        null,
        React.createElement(TabsTrigger, { value: "account" }, "Account"),
        React.createElement(TabsTrigger, { value: "shipping" }, "Shipping"),
      ),
      React.createElement(TabsContent, { value: "account" }, "account panel"),
      React.createElement(TabsContent, { value: "shipping" }, "shipping panel"),
    ),
  )

  const capability = registry.get("settings")
  assert.ok(capability)
  assert.equal(capability.kind, "tabs")
  assert.deepEqual(capability.actions, ["select"])
  assert.deepEqual(capability.read(), {
    value: "account",
    tabs: [
      { value: "account", label: "Account" },
      { value: "shipping", label: "Shipping" },
    ],
  })

  const output = JSON.parse(
    await tool("tabs_select").execute({ target: "settings", value: "shipping" }),
  )
  assert.equal(output.state.value, "shipping")
  assert.match(tree.container.innerHTML, /shipping panel/)

  assert.match(
    await refusalOf("tabs_select", { target: "settings", value: "billing" }),
    /Available tabs: account, shipping\./,
  )

  await tree.unmount()
  assert.equal(registry.get("settings"), undefined)
})

test("a mounted Checkbox exposes checkbox_set and refuses when disabled", async () => {
  const tree = await mount(
    React.createElement(Checkbox.Checkbox, {
      agent: { id: "expedited", label: "Expedited delivery" },
    }),
  )

  assert.deepEqual(registry.read("expedited"), { checked: false, disabled: false })

  const output = JSON.parse(
    await tool("checkbox_set").execute({ target: "expedited", checked: true }),
  )
  assert.equal(output.state.checked, true)

  assert.match(
    await refusalOf("checkbox_set", { target: "expedited", checked: "yes" }),
    /"checked" must be true or false\./,
  )

  await tree.unmount()

  const disabled = await mount(
    React.createElement(Checkbox.Checkbox, { agent: { id: "expedited" }, disabled: true }),
  )
  assert.match(
    await refusalOf("checkbox_set", { target: "expedited", checked: true }),
    /disabled/,
  )
  await disabled.unmount()
})

test("input_set_value reaches a controlled input through the application", async () => {
  const seen: string[] = []

  function Host() {
    const [value, setValue] = React.useState("")
    return React.createElement(Input.Input, {
      agent: { id: "order-search", label: "Search orders" },
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        seen.push(event.target.value)
        setValue(event.target.value)
      },
    })
  }

  const tree = await mount(React.createElement(Host))

  const output = JSON.parse(
    await tool("input_set_value").execute({ target: "order-search", value: "Northwind" }),
  )

  // The application's onChange ran, so the value went through React, not around it.
  assert.deepEqual(seen, ["Northwind"])
  assert.equal(output.state.value, "Northwind")

  const cleared = JSON.parse(await tool("input_clear").execute({ target: "order-search" }))
  assert.equal(cleared.state.value, "")

  await tree.unmount()
})

interface Row {
  id: string
  customer: string
  status: string
  total: number
  note: string
}

const ROWS: Row[] = [
  { id: "1", customer: "Northwind", status: "pending", total: 900, note: "risk hold" },
  { id: "2", customer: "Contoso", status: "paid", total: 120, note: "vip" },
  { id: "3", customer: "Fabrikam", status: "pending", total: 640, note: "chargeback" },
]

test("the data table exposes only its agent-readable surface", async () => {
  const columns: import("../src/bases/radix/ui/data-table").DataTableColumn<Row>[] = [
    { id: "id", header: "ID", accessor: (row) => row.id },
    { id: "customer", header: "Customer", accessor: (row) => row.customer },
    { id: "status", header: "Status", accessor: (row) => row.status },
    { id: "total", header: "Total", accessor: (row) => row.total },
    { id: "note", header: "Internal note", accessor: (row) => row.note, agentHidden: true },
  ]

  const tree = await mount(
    React.createElement(DataTable.DataTable<Row>, {
      agent: { id: "orders", label: "Orders" },
      data: ROWS,
      columns,
      getRowId: (row) => row.id,
    }),
  )

  const state = registry.read("orders") as {
    columns: { id: string }[]
    rows: { id: string; cells: Record<string, unknown> }[]
    rowCount: number
  }

  const exposed = state.columns.map((column) => column.id)
  assert.deepEqual(exposed, ["id", "customer", "status", "total"])
  assert.equal(exposed.includes("note"), false, "an agentHidden column must never be listed")
  assert.equal(exposed.includes("select"), false, "the selection column is not semantic")
  for (const row of state.rows) {
    assert.equal("note" in row.cells, false, "an agentHidden value must never be readable")
  }

  assert.match(
    await refusalOf("table_filter", { target: "orders", column: "note", value: "risk" }),
    /not filterable/,
    "an agentHidden column must not be usable as a filter oracle",
  )

  await tree.unmount()
})

test("table_filter, table_sort and table_select_rows report canonical state", async () => {
  const columns: import("../src/bases/radix/ui/data-table").DataTableColumn<Row>[] = [
    { id: "customer", header: "Customer", accessor: (row) => row.customer },
    { id: "status", header: "Status", accessor: (row) => row.status },
    { id: "total", header: "Total", accessor: (row) => row.total },
  ]

  const tree = await mount(
    React.createElement(DataTable.DataTable<Row>, {
      agent: { id: "orders", label: "Orders" },
      data: ROWS,
      columns,
      getRowId: (row) => row.id,
    }),
  )

  const filtered = JSON.parse(
    await tool("table_filter").execute({ target: "orders", column: "status", value: "pending" }),
  )
  assert.equal(filtered.state.rowCount, 2)
  assert.equal(filtered.state.totalRowCount, 3)
  assert.deepEqual(filtered.state.filters, [{ column: "status", value: "pending" }])

  const sorted = JSON.parse(
    await tool("table_sort").execute({ target: "orders", column: "total", direction: "desc" }),
  )
  assert.deepEqual(sorted.state.sort, [{ column: "total", direction: "desc" }])
  assert.equal(sorted.state.rows[0].cells.customer, "Northwind")

  const selected = JSON.parse(
    await tool("table_select_rows").execute({ target: "orders", rowIds: ["1"] }),
  )
  assert.deepEqual(selected.state.selectedRowIds, ["1"])

  assert.match(
    await refusalOf("table_select_rows", { target: "orders", rowIds: ["2"] }),
    /not present in the filtered row set/,
    "a row filtered out of view cannot be selected",
  )

  assert.match(
    await refusalOf("table_set_page", { target: "orders", page: 9 }),
    /exceeds the page count/,
  )

  await tree.unmount()
})

test("the tool surface follows what is mounted", async () => {
  assert.deepEqual(
    createAgentTools(registry).map((candidate) => candidate.name),
    ["ui_list", "ui_read"],
    "nothing mounted means only discovery tools",
  )

  const tree = await mount(
    React.createElement(Checkbox.Checkbox, { agent: { id: "one" } }),
  )
  assert.ok(createAgentTools(registry).some((candidate) => candidate.name === "checkbox_set"))

  const second = await mount(
    React.createElement(Checkbox.Checkbox, { agent: { id: "two" } }),
  )
  assert.equal(
    createAgentTools(registry).filter((candidate) => candidate.name === "checkbox_set").length,
    1,
    "a second checkbox must not add a second tool",
  )

  await second.unmount()
  await tree.unmount()
  assert.deepEqual(
    createAgentTools(registry).map((candidate) => candidate.name),
    ["ui_list", "ui_read"],
  )
})

test("a mounted Collapsible exposes the disclosure tools and refuses when disabled", async () => {
  const tree = await mount(
    React.createElement(Collapsible.Collapsible, {
      agent: { id: "shipping", label: "Shipping details" },
    }),
  )

  const capability = registry.get("shipping")
  assert.ok(capability)
  assert.equal(capability.kind, "disclosure")
  assert.deepEqual(capability.actions, ["close", "open", "toggle"])

  assert.deepEqual(registry.read("shipping"), { open: false, disabled: false })

  const opened = JSON.parse(
    await tool("disclosure_open").execute({ target: "shipping" }),
  )
  assert.equal(opened.state.open, true)
  assert.equal(opened.state.disabled, false)

  const toggled = JSON.parse(
    await tool("disclosure_toggle").execute({ target: "shipping" }),
  )
  assert.equal(toggled.state.open, false)

  await tree.unmount()

  const disabled = await mount(
    React.createElement(Collapsible.Collapsible, {
      agent: { id: "shipping" },
      disabled: true,
    }),
  )
  assert.deepEqual(registry.read("shipping"), { open: false, disabled: true })

  assert.match(
    await refusalOf("disclosure_open", { target: "shipping" }),
    /disabled/,
  )
  assert.match(
    await refusalOf("disclosure_close", { target: "shipping" }),
    /disabled/,
  )
  assert.match(
    await refusalOf("disclosure_toggle", { target: "shipping" }),
    /disabled/,
  )
  assert.deepEqual(registry.read("shipping"), { open: false, disabled: true })

  await disabled.unmount()
})

test("components that share a kind share its tools", async () => {
  const switchTree = await mount(
    React.createElement(Switch.Switch, { agent: { id: "alerts" } }),
  )
  const switchTools = createAgentTools(registry).map((candidate) => candidate.name)
  assert.ok(
    switchTools.includes("checkbox_set"),
    "Switch shares the checkbox tool surface",
  )
  assert.equal(
    switchTools.includes("switch_set"),
    false,
    "a shared kind adds no new tool",
  )
  await switchTree.unmount()

  const textareaTree = await mount(
    React.createElement(Textarea.Textarea, { agent: { id: "notes" } }),
  )
  const textareaTools = createAgentTools(registry).map((candidate) => candidate.name)
  assert.ok(
    textareaTools.includes("input_set_value"),
    "Textarea shares the input tool surface",
  )
  assert.equal(
    textareaTools.includes("textarea_set_value"),
    false,
    "a shared kind adds no new tool",
  )
  await textareaTree.unmount()
})
