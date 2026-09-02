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
  url: "https://duz-ui.test/",
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
let useCapability: typeof import("../src/lib/duz-ui/use-capability").useCapability
let useAccessibleName: typeof import("../src/lib/duz-ui/agent-identity").useAccessibleName
let useAccessibleNameResolver: typeof import("../src/lib/duz-ui/agent-identity").useAccessibleNameResolver
let getCapabilityRegistry: typeof import("../src/lib/duz-ui/registry").getCapabilityRegistry
let rejectState: typeof import("../src/lib/duz-ui/validate").rejectState
let AgentContent: typeof import("../src/lib/duz-ui/agent-content").AgentContent
let AgentPage: typeof import("../src/lib/duz-ui/agent-page").AgentPage
let agentWithElementId: typeof import("../src/lib/duz-ui/agent-identity").agentWithElementId

before(async () => {
  React = await import("react")
  ;({ createRoot } = await import("react-dom/client"))
  ;({ useCapability } = await import("../src/lib/duz-ui/use-capability"))
  ;({ useAccessibleName, useAccessibleNameResolver } = await import(
    "../src/lib/duz-ui/agent-identity"
  ))
  ;({ getCapabilityRegistry } = await import("../src/lib/duz-ui/registry"))
  ;({ rejectState } = await import("../src/lib/duz-ui/validate"))
  ;({ AgentContent } = await import("../src/lib/duz-ui/agent-content"))
  ;({ AgentPage } = await import("../src/lib/duz-ui/agent-page"))
  ;({ agentWithElementId } = await import("../src/lib/duz-ui/agent-identity"))
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

test("AgentContent reports its subtree as text, with block boundaries kept apart", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(
    React.createElement(
      AgentContent,
      { label: "Recent sales", description: "The five most recent orders" },
      React.createElement("div", null, "Olivia Martin"),
      React.createElement("div", null, "+$1,999.00"),
    ),
  )

  const id = registry.list()[0]?.id ?? ""
  assert.deepEqual(registry.read(id), {
    text: "Olivia Martin +$1,999.00",
    description: "The five most recent orders",
    value: null,
  })
  assert.deepEqual(registry.list()[0]?.actions, [])

  await tree.unmount()
})

test("AgentContent carries content that text cannot, as data the application states", async () => {
  const registry = getCapabilityRegistry()
  // The case this exists for: a chart's numbers are geometry, so its subtree
  // has no text however carefully it is read.
  const series = [
    { month: "Jan", total: 4200 },
    { month: "Feb", total: 5100 },
  ]
  const tree = await mount(
    React.createElement(
      AgentContent,
      { label: "Overview", value: series },
      React.createElement("svg", null),
    ),
  )

  const id = registry.list()[0]?.id ?? ""
  assert.deepEqual(registry.read(id), {
    text: "",
    description: null,
    value: series,
  })

  await tree.unmount()
})

test("AgentContent with agent={false} registers nothing", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(
    React.createElement(AgentContent, { label: "Hidden", agent: false }, "body"),
  )

  assert.deepEqual(registry.list(), [])

  await tree.unmount()
})

test("AgentPage states what the page is, renders nothing, and offers no action", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(
    React.createElement(AgentPage, {
      agent: { id: "users-page" },
      title: "User List",
      description: "Manage your users and their roles here.",
    }),
  )

  const [capability] = registry.describeAll()
  assert.equal(capability?.kind, "page")
  assert.equal(capability?.label, "User List")
  assert.equal(capability?.description, "Manage your users and their roles here.")
  assert.deepEqual(capability?.actions, [])
  assert.deepEqual(registry.read("users-page"), {
    title: "User List",
    description: "Manage your users and their roles here.",
    path: "/",
  })

  await tree.unmount()
})

test("AgentPage without a description reports null rather than omitting the key", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(
    React.createElement(AgentPage, { agent: { id: "bare" }, title: "Dashboard" }),
  )

  assert.equal(
    (registry.read("bare") as { description: string | null }).description,
    null,
  )

  await tree.unmount()
})

/**
 * Identity precedence: an explicit `agent.id` wins; the element's own id is
 * adopted unless it is in a React-generated shape, which is the very
 * instability identity exists to escape; with no id anywhere, the resolved
 * label becomes the id; with no label either, the generated form is the last
 * resort.
 */
test("an explicit agent id wins over the label-derived form", async () => {
  const registry = getCapabilityRegistry()

  function Explicit() {
    useCapability({
      agent: { id: "chosen", label: "Invite User" },
      kind: "tabs",
      read: () => ({}),
      actions: {},
    })
    return null
  }

  const tree = await mount(React.createElement(Explicit))
  assert.deepEqual(registry.list().map((capability) => capability.id), ["chosen"])
  await tree.unmount()
})

test("a React-generated element id is ignored in favour of the label-derived id", async () => {
  const registry = getCapabilityRegistry()

  function GeneratedElementId() {
    // shadcn's Form builds ids like `_r_57_-form-item` from useId output.
    const elementId = `${React.useId()}-form-item`
    useCapability({
      agent: agentWithElementId(undefined, elementId),
      kind: "input",
      defaultLabel: "Email",
      read: () => ({}),
      actions: {},
    })
    return null
  }

  const tree = await mount(React.createElement(GeneratedElementId))
  assert.deepEqual(registry.list().map((capability) => capability.id), ["input.email"])
  await tree.unmount()
})

test("a real application element id is adopted as identity", async () => {
  const registry = getCapabilityRegistry()

  function NamedField() {
    useCapability({
      agent: agentWithElementId(undefined, "invite-email"),
      kind: "input",
      defaultLabel: "Email",
      read: () => ({}),
      actions: {},
    })
    return null
  }

  const tree = await mount(React.createElement(NamedField))
  assert.deepEqual(registry.list().map((capability) => capability.id), [
    "invite-email",
  ])
  await tree.unmount()
})

test("with no label the generated form is the last resort", async () => {
  const registry = getCapabilityRegistry()

  function Anonymous() {
    useCapability({ kind: "tabs", read: () => ({}), actions: {} })
    return null
  }

  const tree = await mount(React.createElement(Anonymous))
  const ids = registry.list().map((capability) => capability.id)
  assert.equal(ids.length, 1)
  assert.match(ids[0] ?? "", /^tabs_[A-Za-z0-9_.-]+$/)
  await tree.unmount()
})

test("AgentContent holds adjacent elements apart but keeps a phrase whole", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(
    React.createElement(
      AgentContent,
      { agent: { id: "inline" }, label: "Inline" },
      // Two things layout holds apart: "Active127" is not a word.
      React.createElement("span", null, "Active"),
      React.createElement("span", null, "127"),
    ),
  )
  assert.equal((registry.read("inline") as { text: string }).text, "Active 127")
  await tree.unmount()

  const phrase = await mount(
    React.createElement(
      AgentContent,
      { agent: { id: "phrase" }, label: "Phrase" },
      "Hello ",
      React.createElement("b", null, "world"),
      "!",
    ),
  )
  // An element between text is one phrase; separating it would read as
  // "Hello world !".
  assert.equal((registry.read("phrase") as { text: string }).text, "Hello world!")
  await phrase.unmount()
})

test("an accessible name from several elements keeps them apart", async () => {
  const registry = getCapabilityRegistry()

  // A button naming itself from content, the way a palette row does: the title
  // and its one-line description are separate elements a person sees held
  // apart. `textContent` fuses them into "DataTableA TanStack-powered table",
  // which also becomes the derived id — this is the "Go to page 5050" bug.
  function Row() {
    const elementRef = React.useRef<HTMLButtonElement>(null)
    const name = useAccessibleName(elementRef, "Button")
    const identitySource = useAccessibleNameResolver(elementRef)
    useCapability<{ label: string }, Record<string, never>>({
      agent: {},
      kind: "button",
      defaultLabel: name,
      identitySource,
      read: () => ({ label: name }),
      actions: {},
    })
    return React.createElement(
      "button",
      { ref: elementRef },
      React.createElement("span", null, "DataTable"),
      React.createElement("span", null, "A TanStack-powered table"),
    )
  }

  const tree = await mount(React.createElement(Row))
  const [capability] = registry.describeAll()
  assert.equal(capability?.label, "DataTable A TanStack-powered table")
  assert.equal(capability?.id, "button.datatable-a-tanstack-powered-table")
  await tree.unmount()
})

/**
 * A button-shaped element: it knows its own name by reading the DOM, and what
 * it says changes when it is pressed. The label is description and must follow
 * the state; the id is addressing and must not.
 */
function SelfNaming({ initial }: { initial: string }) {
  const elementRef = React.useRef<HTMLButtonElement>(null)
  const [label, setLabel] = React.useState(initial)
  const name = useAccessibleName(elementRef, "Button")
  const identitySource = useAccessibleNameResolver(elementRef)
  useCapability<{ label: string }, { press: Record<string, never> }>({
    agent: {},
    kind: "button",
    defaultLabel: name,
    identitySource,
    read: () => ({ label: name }),
    actions: {
      press() {
        setLabel((current) => (current === "Run" ? "Stop" : "Run"))
      },
    },
  })
  return React.createElement("button", { ref: elementRef }, label)
}

test("pressing a button does not rename the element the agent is holding", async () => {
  const registry = getCapabilityRegistry()
  const tree = await mount(React.createElement(SelfNaming, { initial: "Run" }))

  const before = registry.describeAll().find((c) => c.kind === "button")
  assert.ok(before, "the button must register")
  assert.equal(before.id, "button.run", "the id comes from the name it reads, not the fallback")

  await registry.invoke("button.run", "press", {})
  // An action resolves on the commit; re-registration is a passive effect one
  // tick later, which is where a rename would have shown up.
  await new Promise((resolve) => setTimeout(resolve, 0))

  const after = registry.describeAll().find((c) => c.kind === "button")
  assert.ok(after, "the button must still be registered")
  // Addressing held: the id the agent was given still resolves.
  assert.equal(after.id, "button.run")
  assert.ok(registry.get("button.run"), "the id an agent is holding still resolves")
  // Description followed: the listing reports what the button now says.
  assert.equal(after.label, "Stop")

  await tree.unmount()
})

/**
 * An element named by its own text, with the tag and role the component author
 * chose. `element` is the tag, `role` what is written on it.
 */
function NamedByContent({
  tag,
  role,
  text,
  href,
}: {
  tag: string
  role?: string
  text: string
  href?: string
}) {
  const elementRef = React.useRef<HTMLElement>(null)
  const name = useAccessibleName(elementRef, "Fallback")
  const identitySource = useAccessibleNameResolver(elementRef)
  useCapability<{ name: string }, Record<string, never>>({
    agent: {},
    kind: "button",
    defaultLabel: name,
    identitySource,
    read: () => ({ name }),
    actions: {},
  })
  return React.createElement(tag, { ref: elementRef, role, href }, text)
}

test("a role names an element from its content, whatever tag carries it", async () => {
  const registry = getCapabilityRegistry()

  // The common way to write an interactive element that is not a native
  // control. Before roles decided this, a div was unnameable.
  const custom = await mount(
    React.createElement(NamedByContent, { tag: "div", role: "button", text: "Deploy" }),
  )
  assert.equal(registry.describeAll().find((c) => c.kind === "button")?.id, "button.deploy")
  await custom.unmount()

  // A listbox option, which is what a command palette item is.
  const option = await mount(
    React.createElement(NamedByContent, { tag: "div", role: "option", text: "Open Settings" }),
  )
  assert.equal(
    registry.describeAll().find((c) => c.kind === "button")?.id,
    "button.open-settings",
  )
  await option.unmount()

  // A native button still works, now through its implicit role.
  const native = await mount(React.createElement(NamedByContent, { tag: "button", text: "Save" }))
  assert.equal(registry.describeAll().find((c) => c.kind === "button")?.id, "button.save")
  await native.unmount()
})

test("an element whose role is not named from content keeps the fallback", async () => {
  const registry = getCapabilityRegistry()

  // A plain div names nothing: its role is generic, and reading arbitrary
  // descendant text as a name is what the role list exists to prevent.
  const plain = await mount(React.createElement(NamedByContent, { tag: "div", text: "Some text" }))
  const capability = registry.describeAll().find((c) => c.kind === "button")
  assert.ok(capability, "the element must still register")
  assert.equal(capability.label, "Fallback")
  assert.equal(capability.id, "button.fallback")
  await plain.unmount()

  // An anchor is a link only when it has an href; without one its role is
  // generic, exactly as the specification says.
  const anchor = await mount(
    React.createElement(NamedByContent, { tag: "a", text: "Not a link" }),
  )
  assert.equal(registry.describeAll().find((c) => c.kind === "button")?.label, "Fallback")
  await anchor.unmount()

  const link = await mount(
    React.createElement(NamedByContent, { tag: "a", href: "/x", text: "Docs" }),
  )
  assert.equal(registry.describeAll().find((c) => c.kind === "button")?.id, "button.docs")
  await link.unmount()
})
