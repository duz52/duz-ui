import assert from "node:assert/strict"
import test from "node:test"

import { JSDOM } from "jsdom"

/**
 * The WebMCP adapter's wire contract, against both shipping implementations.
 *
 * `executeTool`'s second argument is where the two disagree, and no single
 * value satisfies both:
 *
 *  - The specification takes an object and serialises it itself —
 *    `executeTool(RegisteredTool tool, optional object inputObject = {}, ...)`
 *    in index.bs — and an implementation following it rejects a string with
 *    "WebMCP executeTool requires an object input".
 *  - Chrome 151 takes the already-serialised JSON string, rejects an object
 *    with "Failed to parse input arguments", and requires the argument the
 *    specification makes optional. Measured, not read: `executeTool(tool, {})`
 *    throws in Chrome 151.0.7922.173 with WebMCP enabled.
 *
 * The adapter used to send the string unconditionally, which made Chrome's
 * dialect the contract and failed everywhere else. These two fakes are the two
 * dialects; each gets its own module instance, because the adapter learns the
 * form once and remembers it, and a shared instance would carry one dialect's
 * answer into the other's test.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://agent-ui.test/",
})
const globals = globalThis as Record<string, unknown>
globals["window"] = dom.window
globals["document"] = dom.window.document

/** The one tool the fakes expose, echoing what it was given. */
const ECHO = {
  name: "echo",
  description: "Echoes its input.",
  inputSchema: { type: "object", properties: {}, required: [] },
  execute: (input: unknown) => JSON.stringify({ ok: true, received: input }),
}

type Dialect = "spec" | "chrome"

/**
 * A `document.modelContext` that accepts exactly one of the two argument
 * forms and rejects the other the way that implementation does.
 */
function fakeModelContext(dialect: Dialect) {
  return {
    async getTools() {
      return [{ name: ECHO.name, description: ECHO.description }]
    },
    async executeTool(_tool: unknown, inputArguments?: unknown) {
      if (dialect === "spec") {
        if (typeof inputArguments === "string") {
          throw new Error("WebMCP executeTool requires an object input.")
        }
        return ECHO.execute(inputArguments ?? {})
      }
      if (typeof inputArguments !== "string") {
        throw new Error("Failed to parse input arguments")
      }
      return ECHO.execute(JSON.parse(inputArguments))
    },
  }
}

/** A module instance of its own, so the learned form does not leak between cases. */
async function loadAdapter(dialect: Dialect) {
  Object.defineProperty(dom.window.document, "modelContext", {
    configurable: true,
    value: fakeModelContext(dialect),
  })
  return import(`../src/lib/agent-ui/webmcp.ts?dialect=${dialect}`)
}

for (const dialect of ["spec", "chrome"] as const) {
  test(`executeViaWebMCP reaches a ${dialect}-dialect browser, and the tool sees an object`, async () => {
    const { executeViaWebMCP } = await loadAdapter(dialect)

    const raw = await executeViaWebMCP("echo", { target: "orders", value: "paid" })
    const parsed = JSON.parse(raw) as { ok: boolean; received: unknown }

    assert.equal(parsed.ok, true)
    // Whichever form crossed the boundary, the tool is handed the arguments as
    // an object: the wire format is the adapter's business and nobody else's.
    assert.deepEqual(parsed.received, { target: "orders", value: "paid" })
  })

  test(`a ${dialect}-dialect browser is asked in its own form only once`, async () => {
    const { executeViaWebMCP } = await loadAdapter(dialect)

    // The first call may cost a rejected attempt while the form is unknown;
    // every later call must go straight out in the form that worked, or a
    // write would be offered twice on every invocation.
    await executeViaWebMCP("echo", {})

    const seen: string[] = []
    const context = dom.window.document.modelContext as {
      executeTool: (tool: unknown, input?: unknown) => Promise<string>
    }
    const inner = context.executeTool.bind(context)
    context.executeTool = async (tool: unknown, input?: unknown) => {
      seen.push(typeof input)
      return inner(tool, input)
    }

    await executeViaWebMCP("echo", { a: 1 })
    assert.deepEqual(seen, [dialect === "spec" ? "object" : "string"])
  })
}

test("an unknown tool is refused before any dialect question arises", async () => {
  const { executeViaWebMCP } = await loadAdapter("spec")
  await assert.rejects(
    () => executeViaWebMCP("not-a-tool", {}),
    /not registered with the browser yet/,
  )
})
