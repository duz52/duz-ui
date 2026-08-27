import assert from "node:assert/strict"
import test, { before } from "node:test"

import { JSDOM } from "jsdom"

/**
 * Spec section 10: invoking a callback does not prove the requested state
 * change succeeded. These tests drive a real React tree and assert that an
 * action result always reports the canonical post-commit state, including when
 * the application rejects or transforms the request.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://agent-ui.test/",
  pretendToBeVisual: true,
})

const globals = globalThis as Record<string, unknown>
globals["window"] = dom.window
globals["document"] = dom.window.document
globals["HTMLElement"] = dom.window.HTMLElement
globals["Event"] = dom.window.Event
// Node defines `navigator` as a getter-only global, so it is redefined rather
// than assigned.
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
})

let React: typeof import("react")
let createRoot: typeof import("react-dom/client").createRoot
let useCapability: typeof import("../src/lib/agent-ui/use-capability").useCapability
let getCapabilityRegistry: typeof import("../src/lib/agent-ui/registry").getCapabilityRegistry
let rejectState: typeof import("../src/lib/agent-ui/validate").rejectState

before(async () => {
  React = await import("react")
  ;({ createRoot } = await import("react-dom/client"))
  ;({ useCapability } = await import("../src/lib/agent-ui/use-capability"))
  ;({ getCapabilityRegistry } = await import("../src/lib/agent-ui/registry"))
  ;({ rejectState } = await import("../src/lib/agent-ui/validate"))
})

/**
 * Renders inside `act`, then leaves the act environment. Agent invocations
 * arrive from outside React, so the tests must exercise that path rather than
 * the batched one a test-only wrapper would give them.
 */
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

/** A component that owns its own state, the ordinary uncontrolled case. */
function SelfOwned({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = React.useState(initial)
  useCapability<{ value: string }, { select: { value: string } }>({
    agent: { id, label: "Self owned" },
    kind: "tabs",
    read: () => ({ value }),
    actions: {
      select: (input) => {
        setValue(input.value)
      },
    },
  })
  return React.createElement("span", null, value)
}

/** A component whose parent may refuse the transition, the controlled case. */
function AppControlled({
  id,
  value,
  onRequest,
}: {
  id: string
  value: string
  onRequest: (next: string) => void
}) {
  useCapability<{ value: string }, { select: { value: string } }>({
    agent: { id },
    kind: "tabs",
    read: () => ({ value }),
    actions: {
      select: (input) => {
        onRequest(input.value)
      },
    },
  })
  return React.createElement("span", null, value)
}

test("an accepted action reports the state after the React commit", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(React.createElement(SelfOwned, { id: "tabs-a", initial: "account" }))

  assert.deepEqual(registry.get("tabs-a")?.read(), { value: "account" })

  const result = await registry.invoke("tabs-a", "select", { value: "password" })

  assert.deepEqual(result.state, { value: "password" })
  assert.equal(tree.container.textContent, "password")

  await tree.unmount()
})

test("a rejected action reports the unchanged state, never a manufactured success", async () => {
  const registry = getCapabilityRegistry()

  function Host() {
    const [value, setValue] = React.useState("account")
    return React.createElement(AppControlled, {
      id: "tabs-b",
      value,
      // The application refuses every transition away from "account".
      onRequest: (next: string) => {
        if (next === "billing") setValue(next)
      },
    })
  }

  const tree = await mount(React.createElement(Host))

  const refused = await registry.invoke("tabs-b", "select", { value: "password" })
  assert.deepEqual(refused.state, { value: "account" }, "the refusal must be visible")

  const accepted = await registry.invoke("tabs-b", "select", { value: "billing" })
  assert.deepEqual(accepted.state, { value: "billing" })

  await tree.unmount()
})

test("a transformed value is reported as the application transformed it", async () => {
  const registry = getCapabilityRegistry()

  function Host() {
    const [value, setValue] = React.useState("account")
    return React.createElement(AppControlled, {
      id: "tabs-c",
      value,
      onRequest: (next: string) => setValue(next.toUpperCase()),
    })
  }

  const tree = await mount(React.createElement(Host))
  const result = await registry.invoke("tabs-c", "select", { value: "password" })

  assert.deepEqual(result.state, { value: "PASSWORD" })

  await tree.unmount()
})

test("an asynchronous application decision is awaited before the state is read", async () => {
  const registry = getCapabilityRegistry()

  function Host() {
    const [value, setValue] = React.useState("account")
    useCapability<{ value: string }, { select: { value: string } }>({
      agent: { id: "tabs-d" },
      kind: "tabs",
      read: () => ({ value }),
      actions: {
        select: async (input) => {
          await new Promise((resolve) => setTimeout(resolve, 20))
          setValue(input.value)
          return "committed"
        },
      },
    })
    return React.createElement("span", null, value)
  }

  const tree = await mount(React.createElement(Host))
  const result = await registry.invoke("tabs-d", "select", { value: "password" })

  assert.deepEqual(result.state, { value: "password" })
  assert.equal(result.detail, "committed")

  await tree.unmount()
})

test("a binding rejection surfaces as a CapabilityError and changes nothing", async () => {
  const registry = getCapabilityRegistry()

  function Host() {
    const [value] = React.useState("account")
    useCapability<{ value: string }, { select: { value: string } }>({
      agent: { id: "tabs-e" },
      kind: "tabs",
      read: () => ({ value }),
      actions: {
        select: () => rejectState('"billing" is not one of the available tabs.'),
      },
    })
    return null
  }

  const tree = await mount(React.createElement(Host))

  await assert.rejects(
    () => registry.invoke("tabs-e", "select", { value: "billing" }),
    /not one of the available tabs/,
  )
  assert.deepEqual(registry.get("tabs-e")?.read(), { value: "account" })

  await tree.unmount()
})

test("capability availability equals component availability", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(React.createElement(SelfOwned, { id: "tabs-f", initial: "a" }))

  assert.ok(registry.get("tabs-f"))
  await tree.unmount()
  assert.equal(registry.get("tabs-f"), undefined)
})

test("an omitted agent id gets a document-local identity, agent={false} gets none", async () => {
  const registry = getCapabilityRegistry()

  function Generated() {
    useCapability({ kind: "tabs", read: () => ({}), actions: {} })
    return null
  }
  function OptedOut() {
    useCapability({ agent: false, kind: "tabs", read: () => ({}), actions: {} })
    return null
  }

  const generated = await mount(React.createElement(Generated))
  const ids = registry.list().map((capability) => capability.id)
  assert.equal(ids.length, 1)
  assert.match(ids[0] ?? "", /^tabs_[A-Za-z0-9_.-]+$/)
  await generated.unmount()

  const optedOut = await mount(React.createElement(OptedOut))
  assert.deepEqual(registry.list(), [])
  await optedOut.unmount()
})
