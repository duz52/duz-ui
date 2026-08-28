import assert from "node:assert/strict"
import test, { before } from "node:test"

import { JSDOM } from "jsdom"

/**
 * Integration test B — no wiring, and real names.
 *
 * Mounts the real shipped components from packages/registry/src/bases/radix/ui/ in jsdom
 * with no provider and no `agent` prop anywhere, and proves the browser would
 * see tools — by installing a fake `document.modelContext` that stands in for
 * Chrome and checking what it holds.
 *
 * jsdom has no `document.modelContext` and the CLI has no React, so this
 * cannot be one file with test A. Each test file is its own process, so the
 * jsdom host setup is duplicated from components.test.tsx rather than shared.
 *
 * Run with `pnpm --filter @agent-ui/registry test`.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://agent-ui.test/",
  pretendToBeVisual: true,
})

const globals = globalThis as Record<string, unknown>
globals["window"] = dom.window
globals["document"] = dom.window.document
globals["HTMLElement"] = dom.window.HTMLElement
globals["HTMLInputElement"] = dom.window.HTMLInputElement
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
// of the test host, not of Agent UI.
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

/**
 * A fake `document.modelContext` that stands in for Chrome's WebMCP
 * implementation. Backed by a Map, honouring the `signal` option by
 * unregistering on abort. It is test scaffolding, not a shipped shim.
 *
 * Installed on the jsdom document before any Agent UI module is imported, so
 * the runtime's composition root (`getAgentUIRuntime` → `connectWebMCP`) sees
 * a context on first access and wires the adapter to this fake.
 */
class FakeModelContext extends EventTarget {
  private readonly tools = new Map<string, WebMCP.ModelContextTool>()

  async registerTool(
    tool: WebMCP.ModelContextTool,
    options?: WebMCP.ModelContextRegisterToolOptions,
  ): Promise<void> {
    this.tools.set(tool.name, tool)
    const signal = options?.signal
    if (signal) {
      if (signal.aborted) {
        this.tools.delete(tool.name)
      } else {
        signal.addEventListener("abort", () => {
          this.tools.delete(tool.name)
        })
      }
    }
  }

  async getTools(
    _options?: WebMCP.ModelContextGetToolOptions,
  ): Promise<WebMCP.RegisteredTool[]> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      title: tool.title ?? tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      window: dom.window,
      origin: "https://agent-ui.test",
      annotations: tool.annotations,
    }))
  }

  /**
   * Runs a registered tool the way an agent would: through the context's own
   * dispatch, not by reading the registry directly.
   */
  async executeTool(
    tool: WebMCP.RegisteredTool,
    inputArguments?: string,
  ): Promise<string> {
    const definition = this.tools.get(tool.name)
    if (!definition) {
      throw new Error(`The "${tool.name}" tool is not registered.`)
    }
    const input: Record<string, unknown> = inputArguments
      ? JSON.parse(inputArguments)
      : {}
    const result = await definition.execute(input, {
      signal: new AbortController().signal,
    })
    return result as string
  }
}

const fake = new FakeModelContext()
Object.defineProperty(dom.window.document, "modelContext", {
  configurable: true,
  value: fake,
})

let React: typeof import("react")
let createRoot: typeof import("react-dom/client").createRoot
let Checkbox: typeof import("../src/bases/radix/ui/checkbox").Checkbox
let Label: typeof import("../src/bases/radix/ui/label").Label

before(async () => {
  React = await import("react")
  ;({ createRoot } = await import("react-dom/client"))
  ;({ Checkbox } = await import("../src/bases/radix/ui/checkbox"))
  ;({ Label } = await import("../src/bases/radix/ui/label"))
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

/**
 * The WebMCP adapter reconciles asynchronously via a floating async loop that
 * awaits `registerTool` for each tool. Flush the event loop so the loop
 * completes before assertions read the fake context. This is the same pattern
 * as `afterReactFlush` in the runtime — deterministic, not a sleep.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

interface CapabilityDescriptor {
  id: string
  kind: string
  label?: string
  actions: string[]
}

interface ListResult {
  ok: boolean
  action: string
  state: { capabilities: CapabilityDescriptor[] }
}

/** Calls ui_list through the fake context's executeTool, the way an agent would. */
async function listCapabilities(): Promise<CapabilityDescriptor[]> {
  const registered = await fake.getTools()
  const uiList = registered.find((t) => t.name === "ui_list")
  if (!uiList) throw new Error("ui_list is not registered")
  const raw = await fake.executeTool(uiList, "{}")
  return (JSON.parse(raw) as ListResult).state.capabilities
}

test("no provider and no agent prop — the browser still sees tools", async () => {
  // 1. Before mounting anything, the fake context holds no tools. The runtime
  //    is created lazily on first mount, so nothing has connected yet.
  let tools = await fake.getTools()
  assert.equal(tools.length, 0, "no tools before anything is mounted")

  // 2. Mounting a Checkbox — with no provider rendered and no agent prop —
  //    results in ui_list, ui_read and checkbox_set being registered with the
  //    fake context. This is the regression test for the adapter never being
  //    connected.
  let tree = await mount(React.createElement(Checkbox))
  await settle()
  tools = await fake.getTools()
  const names = tools.map((t) => t.name)
  assert.ok(names.includes("ui_list"), "ui_list must be registered")
  assert.ok(names.includes("ui_read"), "ui_read must be registered")
  assert.ok(names.includes("checkbox_set"), "checkbox_set must be registered")
  await tree.unmount()
  await settle()

  // 3. Mounting two checkboxes with associated labels makes ui_list report two
  //    capabilities with ids recents and home and labels Recents and Home —
  //    not generated ids and not "Checkbox".
  tree = await mount(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(Checkbox, { id: "recents" }),
      React.createElement(Label, { htmlFor: "recents" }, "Recents"),
      React.createElement(Checkbox, { id: "home" }),
      React.createElement(Label, { htmlFor: "home" }, "Home"),
    ),
  )
  await settle()
  const capabilities = await listCapabilities()
  assert.equal(capabilities.length, 2, "two checkboxes must produce two capabilities")
  const byId = new Map(capabilities.map((c) => [c.id, c]))
  assert.equal(byId.get("recents")?.label, "Recents", "label must be derived from the <label>")
  assert.equal(byId.get("home")?.label, "Home", "label must be derived from the <label>")
  await tree.unmount()
  await settle()

  // 4. An explicit agent prop still wins over both derived values.
  tree = await mount(
    React.createElement(Checkbox, {
      id: "recents",
      agent: { id: "explicit", label: "Explicit" },
    }),
  )
  await settle()
  const explicitCapabilities = await listCapabilities()
  assert.equal(explicitCapabilities.length, 1)
  assert.equal(explicitCapabilities[0]?.id, "explicit", "explicit agent.id must win")
  assert.equal(explicitCapabilities[0]?.label, "Explicit", "explicit agent.label must win")
  await tree.unmount()
  await settle()

  // 5. Unmounting everything removes the capability-specific tools from the
  //    fake context again. The discovery tools (ui_list, ui_read) remain
  //    because the adapter stays connected for the document lifetime.
  tools = await fake.getTools()
  const finalNames = [...tools.map((t) => t.name)].sort()
  assert.deepEqual(finalNames, ["ui_list", "ui_read"], "only discovery tools must remain")
})
