import assert from "node:assert/strict"
import test from "node:test"

import {
  CapabilityError,
  type Capability,
  type CapabilityResult,
} from "../src/lib/agent-ui/capability"
import { getCapabilityRegistry } from "../src/lib/agent-ui/registry"

/**
 * The registry is the only live capability index. These tests pin the
 * invariants that everything above it relies on.
 */

interface StubOptions {
  id: string
  kind?: string
  label?: string
  actions?: string[]
  state?: Record<string, unknown>
  onInvoke?: (action: string, input: unknown) => unknown
}

function stub(options: StubOptions): Capability {
  const actions = options.actions ?? ["set"]
  let state = options.state ?? { value: null }
  return {
    id: options.id,
    kind: options.kind ?? "stub",
    label: options.label,
    actions,
    read: () => state,
    async invoke(action, input): Promise<CapabilityResult> {
      const detail = options.onInvoke?.(action, input)
      state = { ...state, lastAction: action, lastInput: input }
      return { state, detail }
    },
  }
}

function freshRegistry() {
  const registry = getCapabilityRegistry()
  for (const capability of registry.list()) {
    // Each test starts from an empty index; the registry is a document-scoped
    // singleton by design, so tests clean up after themselves.
    const unregister = registry.register(capability)
    unregister()
  }
  return registry
}

test("registration defines availability and unregistration removes it", () => {
  const registry = freshRegistry()
  const unregister = registry.register(stub({ id: "orders", kind: "data-table" }))

  assert.equal(registry.get("orders")?.kind, "data-table")
  assert.deepEqual(registry.listKinds(), ["data-table"])
  assert.equal(registry.list().length, 1)

  unregister()

  assert.equal(registry.get("orders"), undefined)
  assert.deepEqual(registry.list(), [])
  assert.deepEqual(registry.listKinds(), [])
})

test("every mounted capability has exactly one identity", () => {
  const registry = freshRegistry()
  const first = registry.register(stub({ id: "orders" }))

  assert.throws(
    () => registry.register(stub({ id: "orders" })),
    /duplicate capability id "orders"/,
  )

  first()
})

test("re-registering the same capability object is idempotent", () => {
  const registry = freshRegistry()
  const capability = stub({ id: "orders" })
  const first = registry.register(capability)
  const second = registry.register(capability)

  assert.equal(registry.list().length, 1)

  second()
  assert.equal(registry.get("orders"), undefined)
  first()
})

test("unregistering a replaced identity does not remove the replacement", () => {
  const registry = freshRegistry()
  const first = registry.register(stub({ id: "orders", label: "First" }))
  first()
  const second = registry.register(stub({ id: "orders", label: "Second" }))

  first()

  assert.equal(registry.get("orders")?.label, "Second")
  second()
})

test("discovery reports id, kind, label and actions", () => {
  const registry = freshRegistry()
  const off = registry.register(
    stub({ id: "orders", kind: "data-table", label: "Orders", actions: ["filter", "sort"] }),
  )

  assert.deepEqual(registry.describeAll(), [
    { id: "orders", kind: "data-table", label: "Orders", actions: ["filter", "sort"] },
  ])

  off()
})

test("dispatch reaches the capability and returns canonical state", async () => {
  const registry = freshRegistry()
  const seen: unknown[] = []
  const off = registry.register(
    stub({
      id: "orders",
      actions: ["set"],
      onInvoke: (action, input) => {
        seen.push([action, input])
        return "detail"
      },
    }),
  )

  const result = await registry.invoke("orders", "set", { value: 1 })

  assert.deepEqual(seen, [["set", { value: 1 }]])
  assert.equal(result.detail, "detail")
  assert.deepEqual(result.state["lastInput"], { value: 1 })

  off()
})

test("an unknown target is rejected with the available ids", async () => {
  const registry = freshRegistry()
  const off = registry.register(stub({ id: "orders" }))

  await assert.rejects(
    () => registry.invoke("customers", "set", {}),
    (error: unknown) => {
      assert.ok(error instanceof CapabilityError)
      assert.equal(error.code, "unknown_target")
      assert.match(error.message, /Available ids: orders\./)
      return true
    },
  )

  off()
})

test("an unsupported action is rejected with the supported ones", async () => {
  const registry = freshRegistry()
  const off = registry.register(
    stub({ id: "orders", kind: "data-table", actions: ["filter", "sort"] }),
  )

  await assert.rejects(
    () => registry.invoke("orders", "delete", {}),
    (error: unknown) => {
      assert.ok(error instanceof CapabilityError)
      assert.equal(error.code, "unsupported_action")
      assert.match(error.message, /Supported actions: filter, sort\./)
      return true
    },
  )

  off()
})

test("subscribers are notified on every availability change", () => {
  const registry = freshRegistry()
  let notifications = 0
  const unsubscribe = registry.subscribe(() => {
    notifications += 1
  })

  const off = registry.register(stub({ id: "orders" }))
  assert.equal(notifications, 1)
  off()
  assert.equal(notifications, 2)
  off()
  assert.equal(notifications, 2, "unregistering twice must not notify twice")

  unsubscribe()
  const again = registry.register(stub({ id: "orders" }))
  assert.equal(notifications, 2)
  again()
})

test("generated identity is document-local and tool-name safe", () => {
  const registry = freshRegistry()
  assert.equal(registry.createId("tabs", "«r1»"), "tabs_r1")
  assert.match(registry.createId("data-table", ":r2:"), /^[A-Za-z0-9_.-]+$/)
})

test("require resolves without reading, and refuses an unknown id the way an agent can correct", () => {
  const registry = freshRegistry()
  let reads = 0
  const capability: Capability = {
    id: "orders",
    kind: "data-table",
    actions: [],
    read: () => {
      reads += 1
      return { rows: [] }
    },
    async invoke() {
      return { state: { rows: [] } }
    },
  }
  registry.register(capability)

  assert.equal(registry.require("orders"), capability)
  // Resolving an id must not cost what reading it costs: a five-hundred-row
  // table builds its rows in read(), and a caller that only needs the
  // capability must not pay for them.
  assert.equal(reads, 0)

  assert.throws(
    () => registry.require("ordrs"),
    (error: unknown) => {
      assert.ok(error instanceof CapabilityError)
      assert.equal(error.code, "unknown_target")
      assert.match(error.message, /Available ids: orders\./)
      return true
    },
  )
})
