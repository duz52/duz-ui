/**
 * Agent UI — protocol-independent tool definitions.
 *
 * This file is deliberately separate from `webmcp.ts`: it defines the agent
 * tool surface as plain data plus executors that dispatch exclusively through
 * the capability registry. It never references `document.modelContext`, so the
 * gallery playground can execute exactly the same definitions against the same
 * registry without a WebMCP-capable browser. `webmcp.ts` is the thin protocol
 * adapter that registers these tools with the browser; everything semantic
 * lives here.
 */

import {
  CapabilityError,
  type Capability,
  type CapabilityState,
} from "./capability"
import type { CapabilityRegistry } from "./registry"
import { expectOptionalString, expectString } from "./validate"

/**
 * What a tool acts on. Declared rather than inferred: a host that wants to
 * offer a tool against the live capabilities — the gallery's runner, a
 * devtool, a test harness — otherwise has to parse the tool name, and the
 * name is a label, not a contract.
 */
export type AgentToolScope =
  /** Acts on the page as a whole; takes no target. */
  | { on: "page" }
  /** Reads any live capability, whatever its kind. */
  | { on: "any-capability" }
  /** Invokes one action of every capability of one kind. */
  | { on: "kind"; kind: string; action: string }
  /** Bound to exactly one capability, as a business action is. */
  | { on: "capability"; id: string }

export interface AgentTool {
  name: string
  description: string
  scope: AgentToolScope
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties: false
  }
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute(input: Record<string, unknown>): Promise<string>
}

const TARGET_PROPERTY = {
  type: "string",
  description: "The id of the UI element to act on, as returned by ui_list.",
}

interface KindToolDef {
  kind: string
  name: string
  action: string
  description: string
  /** Action-specific JSON Schema properties; `target` is added uniformly. */
  inputSchema: Record<string, unknown>
}

/**
 * Declarative mapping from capability kinds to WebMCP tools. Every tool maps
 * 1:1 onto a capability action name. `target` is always required and added by
 * `buildInputSchema`; `ui_list` is how the agent learns valid ids.
 */
const KIND_TOOLS: readonly KindToolDef[] = [
  {
    kind: "tabs",
    name: "tabs_select",
    action: "select",
    description: "Switch the active tab of a tabs element to the given value.",
    inputSchema: {
      value: {
        type: "string",
        description:
          "The tab value to activate. Call ui_read on the target to see available values.",
      },
    },
  },
  {
    kind: "select",
    name: "select_choose",
    action: "choose",
    description: "Choose a value on a select or combobox element.",
    inputSchema: {
      value: {
        type: "string",
        description:
          "The value to choose. Call ui_read on the target to see available values.",
      },
    },
  },
  {
    kind: "select",
    name: "select_clear",
    action: "clear",
    description: "Clear the selection on a select or combobox element.",
    inputSchema: {},
  },
  {
    kind: "multi-select",
    name: "multi_select_set",
    action: "set",
    description:
      "Set the selected values of a multi-select element, replacing the previous selection.",
    inputSchema: {
      values: {
        type: "array",
        items: { type: "string" },
        description:
          "The values to select, replacing any previous selection. Pass an empty array to clear the selection. Call ui_read on the target to see available options.",
      },
    },
  },
  {
    kind: "checkbox",
    name: "checkbox_set",
    action: "set",
    description: "Set the checked state of a checkbox or switch.",
    inputSchema: {
      checked: {
        type: "boolean",
        description: "Whether the checkbox should be checked.",
      },
    },
  },
  {
    kind: "button",
    name: "button_press",
    action: "press",
    description:
      "Press a button, exactly as a person clicking it would. The button's own name — the text a person reads on it, like \"Send Invitation\" — is its label in ui_list. Pressing may submit a form, open a dialog, navigate, or trigger whatever the button is wired to.",
    inputSchema: {},
  },
  {
    kind: "dialog",
    name: "dialog_open",
    action: "open",
    description: "Open a dialog element.",
    inputSchema: {},
  },
  {
    kind: "dialog",
    name: "dialog_close",
    action: "close",
    description: "Close a dialog element.",
    inputSchema: {},
  },
  {
    kind: "disclosure",
    name: "disclosure_open",
    action: "open",
    description: "Open a collapsible or popover element.",
    inputSchema: {},
  },
  {
    kind: "disclosure",
    name: "disclosure_close",
    action: "close",
    description: "Close a collapsible or popover element.",
    inputSchema: {},
  },
  {
    kind: "disclosure",
    name: "disclosure_toggle",
    action: "toggle",
    description: "Toggle the open state of a collapsible or popover element.",
    inputSchema: {},
  },
  {
    kind: "input",
    name: "input_set_value",
    action: "set_value",
    description: "Set the value of a text input or textarea.",
    inputSchema: {
      value: {
        type: "string",
        description: "The new value for the input.",
      },
    },
  },
  {
    kind: "input",
    name: "input_clear",
    action: "clear",
    description: "Clear the value of a text input or textarea.",
    inputSchema: {},
  },
  {
    kind: "data-table",
    name: "table_filter",
    action: "filter",
    description: "Apply a column filter to a data table.",
    inputSchema: {
      column: {
        type: "string",
        description:
          "The column id to filter. Call ui_read on the target to see column ids.",
      },
      value: {
        type: "string",
        description:
          "The filter value to apply. Pass an empty string to clear the filter.",
      },
    },
  },
  {
    kind: "data-table",
    name: "table_sort",
    action: "sort",
    description: "Sort a data table by a column in the given direction.",
    inputSchema: {
      column: {
        type: "string",
        description:
          "The column id to sort by. Call ui_read on the target to see column ids.",
      },
      direction: {
        type: "string",
        enum: ["asc", "desc"],
        description: 'Sort direction: "asc" or "desc".',
      },
    },
  },
  {
    kind: "data-table",
    name: "table_select_rows",
    action: "select_rows",
    description: "Select rows in a data table by id.",
    inputSchema: {
      rowIds: {
        type: "array",
        items: { type: "string" },
        description:
          "The row ids to select. Call ui_read on the target to see row ids.",
      },
    },
  },
  {
    kind: "data-table",
    name: "table_set_page",
    action: "set_page",
    description: "Navigate a paginated data table to a page number.",
    inputSchema: {
      page: {
        type: "integer",
        minimum: 1,
        description: "The 1-based page index to navigate to.",
      },
    },
  },
  {
    kind: "data-table",
    name: "table_set_column_visibility",
    action: "set_column_visibility",
    description: "Show or hide a column in a data table.",
    inputSchema: {
      column: {
        type: "string",
        description:
          "The column id to show or hide. Call ui_read on the target to see column ids.",
      },
      visible: {
        type: "boolean",
        description: "True to show the column, false to hide it.",
      },
    },
  },
  {
    kind: "accordion",
    name: "accordion_expand",
    action: "expand",
    description: "Expand a section of an accordion by its value.",
    inputSchema: {
      value: {
        type: "string",
        description:
          "The section value to expand. Call ui_read on the target to see available sections.",
      },
    },
  },
  {
    kind: "accordion",
    name: "accordion_collapse",
    action: "collapse",
    description: "Collapse a section of an accordion by its value.",
    inputSchema: {
      value: {
        type: "string",
        description:
          "The section value to collapse. Call ui_read on the target to see available sections.",
      },
    },
  },
  {
    kind: "slider",
    name: "slider_set",
    action: "set",
    description:
      "Set the value of a slider. There is one number per thumb; most sliders have exactly one.",
    inputSchema: {
      value: {
        type: "array",
        items: { type: "number" },
        description:
          "The new values for each thumb. There is one number per thumb; most sliders have exactly one. Call ui_read on the target to see the current value, min, max and step.",
      },
    },
  },
  {
    kind: "date",
    name: "date_set",
    action: "set",
    description:
      "Set the selected date or dates of a calendar element, replacing the previous selection. The value is an array of YYYY-MM-DD strings whose length depends on the calendar's mode: single mode takes zero or one date (an empty array clears the selection), multiple mode takes any number of dates, and range mode takes exactly two dates, start then end. A calendar that requires a selection refuses an empty array. Call ui_read on the target to see the current mode, whether it is required, its value and its bounds.",
    inputSchema: {
      value: {
        type: "array",
        items: { type: "string" },
        description:
          "Dates as YYYY-MM-DD strings, replacing the selection. Length must match the mode: single 0-1, multiple any, range exactly 2 (start, end). A calendar whose read state has required=true refuses an empty array.",
      },
    },
  },
]

/**
 * Output budget for one tool result.
 *
 * This is our own choice, not a rule from anywhere else: the WebMCP
 * specification says nothing about output length (it constrains *input*
 * lengths, in its security mitigations, and leaves output to the
 * implementation), and Chrome's guidance asks only that results be
 * "written clearly and formatted correctly". A bound still belongs here —
 * an unbounded result would spend the agent's context on one call — but it
 * has to be wide enough for the state of a real component. A table's
 * columns, paging, sort, filters, selection and visible rows do not fit in
 * a couple of thousand characters, and a read that cannot return its own
 * subject is worthless.
 */
const MAX_OUTPUT = 8000

/** Longest string a digest keeps verbatim before cutting it. */
const DIGEST_STRING_LIMIT = 80

/** Longest scalar array a digest keeps whole; longer ones become `{items}`. */
const DIGEST_ARRAY_LIMIT = 8

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

/**
 * A generic, kind-agnostic digest of one capability state: scalars survive,
 * bulk is replaced by counts, so a listing can carry every element's state
 * inside one response.
 *
 * Reading is pull-based: `digest` runs only while a tool result is being
 * produced, never on render or registration, so it stays off every hot path.
 */
export function digest(state: CapabilityState): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      out[key] =
        value.length <= DIGEST_ARRAY_LIMIT && value.every(isScalar)
          ? value
          : { items: value.length }
    } else if (isRecord(value)) {
      out[key] = { fields: Object.keys(value).length }
    } else if (typeof value === "string" && value.length > DIGEST_STRING_LIMIT) {
      out[key] = `${value.slice(0, DIGEST_STRING_LIMIT)}…`
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Serialise a tool result for the agent. WebMCP requires string output.
 *
 * Every tool except `ui_list` returns its result as-is; one above the budget
 * is refused with a message that names the tool and asks the agent to narrow
 * its request. `ui_list` cannot refuse — a listing that lists nothing leaves
 * the agent with no way forward — so it reduces its document instead (see
 * `serialiseListDocument`).
 */
function serialise(toolName: string, value: unknown): string {
  const json = JSON.stringify(value)
  if (json.length <= MAX_OUTPUT) return json
  return JSON.stringify({
    ok: false,
    error: {
      code: "output_too_large",
      message: `The result of "${toolName}" is ${json.length} characters, above this page's ${MAX_OUTPUT} character output budget. Narrow the request and try again.`,
    },
  })
}

/** One element of the `ui_list` document. */
interface ListElement {
  id: string
  kind: string
  label?: string
  description?: string
  actions?: string[]
  /** The component's own summary when it provides one, else the state digest. */
  state?: string | Record<string, unknown>
  children?: ListElement[]
  /**
   * Set instead of `children` when the output budget dropped them: the count,
   * the targeted `ui_list` call that recovers them, and the offset to
   * continue from when that listing is itself windowed, so honesty always
   * comes with a way to act on it.
   */
  childrenOmitted?: string
}

/** The `ui_list` response: the page header plus every live element. */
interface ListDocument {
  ok: true
  action: "list"
  /** Present only in a targeted listing: the element whose children are listed. */
  target?: string
  page?: { title?: string; description?: string }
  elements: ListElement[]
  /**
   * Present only when the elements were cut — by the caller's offset/limit or
   * by the reduction's final step — so a cut listing can be walked the same
   * way a windowed `ui_read` can.
   */
  window?: { offset: number; returned: number; total: number }
}

function* eachElement(elements: ListElement[]): Generator<ListElement> {
  for (const element of elements) {
    yield element
    if (element.children) yield* eachElement(element.children)
  }
}

/**
 * Build the `ui_list` document: the page header taken from the mounted `page`
 * capability, if any, and every other live capability as an element carrying
 * its current state, nested under the capability its `owner` names.
 *
 * With `target`, the document carries that element's children instead of the
 * whole page — the recovery an element's `childrenOmitted` marker names. The
 * target itself is not repeated: the agent already has it from the listing
 * that named it. A live target with no children lists as an empty document,
 * and the caller resolves `target` through the registry, so an unknown id is
 * rejected with the registry's own message.
 *
 * Element states are read here, at listing time. Reading is pull-based —
 * nothing reads capability state on render or registration — so a listing
 * stays off every hot path.
 */
function buildListDocument(
  registry: CapabilityRegistry,
  target?: string,
): ListDocument {
  const capabilities = registry.list()
  const doc: ListDocument = { ok: true, action: "list", elements: [] }

  if (target !== undefined) {
    doc.target = target
  } else {
    // The page is the document's header, not an element of it. Several page
    // capabilities is a page bug: use the first and leave the rest out.
    const pages = capabilities.filter((capability) => capability.kind === "page")
    const page = pages[0]
    if (page) {
      if (pages.length > 1) {
        console.error(
          "[agent-ui]",
          `Multiple capabilities of kind "page" are mounted; listing "${page.id}" as the page and leaving the rest out.`,
        )
      }
      doc.page = { title: page.label, description: page.description }
    }
  }

  const byId = new Map(
    capabilities.map((capability) => [capability.id, capability]),
  )
  const nodes = new Map<string, ListElement>()
  for (const capability of capabilities) {
    if (capability.kind === "page") continue
    const actions = [...capability.actions]
    nodes.set(capability.id, {
      id: capability.id,
      kind: capability.kind,
      label: capability.label,
      description: capability.description,
      actions: actions.length > 0 ? actions : undefined,
      state: capability.summarise?.() ?? digest(capability.read()),
      children: [],
    })
  }

  // Resolve ownership against the listed elements: an element whose owner
  // names one becomes that element's child; a dangling owner — or one that
  // names the page itself — leaves the element a root, so the list never
  // silently drops an element. Roots keep registration order, and a cycle
  // cannot hang: the walk stops on any element already placed, and every
  // element is placed exactly once.
  const validOwner = (id: string): string | undefined => {
    const ownerId = byId.get(id)?.owner
    return ownerId !== undefined && ownerId !== id && nodes.has(ownerId)
      ? ownerId
      : undefined
  }
  const attached = new Set<string>()
  const place = (id: string): void => {
    if (attached.has(id)) return

    // Walk up the owner chain to where this subtree anchors: an element with
    // no valid owner, one that is already in the tree, or — in a cycle — the
    // element whose owner loops back, which becomes a root so nothing is
    // dropped.
    const chain: string[] = []
    const walking = new Set<string>()
    let current = id
    for (;;) {
      if (attached.has(current) || walking.has(current)) break
      walking.add(current)
      chain.push(current)
      const ownerId = validOwner(current)
      if (ownerId === undefined) break
      current = ownerId
    }

    // `chain` is never empty: `id` itself is pushed on the first iteration.
    const anchorId = chain.pop()!
    const anchorOwner = validOwner(anchorId)
    attached.add(anchorId)
    if (anchorOwner !== undefined && attached.has(anchorOwner)) {
      nodes.get(anchorOwner)!.children!.push(nodes.get(anchorId)!)
    } else {
      doc.elements.push(nodes.get(anchorId)!)
    }
    for (const childId of chain.reverse()) {
      attached.add(childId)
      nodes.get(validOwner(childId)!)!.children!.push(nodes.get(childId)!)
    }
  }

  for (const id of nodes.keys()) place(id)

  // An element with no children carries no `children` key at all.
  for (const node of nodes.values()) {
    if (node.children?.length === 0) delete node.children
  }

  // A targeted listing is the target's own children, resolved by the same
  // placement as the whole page's; the target's node itself is not repeated.
  if (target !== undefined) {
    doc.elements = nodes.get(target)?.children ?? []
  }

  return doc
}

/**
 * Replace an element's children with a marker that names the recovery: how
 * many there are, the targeted `ui_list` call that lists them, and — when
 * that listing is itself windowed — the offset to continue from. A bare
 * count would tell the agent children exist and leave it no way to see them.
 */
function omitChildren(element: ListElement): void {
  element.childrenOmitted = `${element.children!.length} children omitted; call ui_list with target "${element.id}" to list them; if that listing is windowed, continue from window.offset + window.returned`
  delete element.children
}

/**
 * Serialise the list document, shedding in a fixed order that keeps the most
 * navigable information when the full document exceeds the output budget:
 * the structure first, then the states, then the descriptions, then the
 * elements themselves. Each step re-serialises and returns as soon as the
 * result fits. The last step always fits — it can keep a single element — so
 * `ui_list` never returns an empty listing while capabilities exist.
 *
 * The caller's `offset` and `limit` window the elements the call returns —
 * the roots, or a target's children — before any shedding. Whenever those
 * elements were cut, by that window or by the final shedding step, the
 * response reports `window` — offset, returned, total — as `ui_read` does
 * over its list field, so one walk covers both tools; a complete listing
 * carries no window key.
 */
function serialiseListDocument(
  doc: ListDocument,
  offset: number | undefined,
  limit: number | undefined,
): string {
  const total = doc.elements.length
  // An offset past the end is not an error: the empty window reports the
  // true total, so the agent learns where the list ends.
  const start = Math.min(offset ?? 0, total)
  const count = limit !== undefined ? Math.min(limit, total - start) : total - start
  doc.elements = doc.elements.slice(start, start + count)
  if (start !== 0 || count !== total) {
    doc.window = { offset: start, returned: count, total }
  }

  let json = JSON.stringify(doc)
  if (json.length <= MAX_OUTPUT) return json

  // Step 2: keep each root's own children; drop everything below them.
  for (const root of doc.elements) {
    for (const child of root.children ?? []) {
      if (child.children?.length) omitChildren(child)
    }
  }
  json = JSON.stringify(doc)
  if (json.length <= MAX_OUTPUT) return json

  const everyElement = [...eachElement(doc.elements)]

  // Step 3: drop every remaining children array — after step 2, the roots' own.
  for (const element of everyElement) {
    if (element.children?.length) omitChildren(element)
  }
  json = JSON.stringify(doc)
  if (json.length <= MAX_OUTPUT) return json

  // Step 4: drop every state.
  for (const element of everyElement) delete element.state
  json = JSON.stringify(doc)
  if (json.length <= MAX_OUTPUT) return json

  // Step 5: drop every description.
  for (const element of everyElement) delete element.description
  if (doc.page) delete doc.page.description
  json = JSON.stringify(doc)
  if (json.length <= MAX_OUTPUT) return json

  // Step 6: keep only the first N elements that fit. The largest N is found by
  // bisection — a document with fewer elements is never larger. Even a single
  // element is accepted when nothing smaller exists. This is a cut like any
  // other, so the window reports it.
  const fits = (shown: number): boolean =>
    JSON.stringify({
      ...doc,
      elements: doc.elements.slice(0, shown),
      window: { offset: start, returned: shown, total },
    }).length <= MAX_OUTPUT

  let low = 1
  let high = doc.elements.length
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (fits(mid)) low = mid
    else high = mid
  }
  doc.elements = doc.elements.slice(0, low)
  doc.window = { offset: start, returned: low, total }
  return JSON.stringify(doc)
}

function withoutTarget(input: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...input }
  delete rest.target
  return rest
}

/**
 * `AgentAction` validates its own id, so no sanitising or truncation is needed
 * here - a name that could collide would be a developer error the component
 * already refuses.
 */
function actionToolName(id: string): string {
  return `action_${id}`
}

function buildInputSchema(
  properties: Record<string, unknown>,
): AgentTool["inputSchema"] {
  return {
    type: "object",
    properties: { target: TARGET_PROPERTY, ...properties },
    required: ["target", ...Object.keys(properties)],
    additionalProperties: false,
  }
}

function makeExecutor(
  toolName: string,
  run: (input: Record<string, unknown>) => Promise<string>,
): AgentTool["execute"] {
  return async (input: Record<string, unknown>): Promise<string> => {
    try {
      return await run(input)
    } catch (error) {
      // A refusal travels in the returned result, never as a thrown error.
      // Chrome's WebMCP discards a thrown error's message entirely — the agent
      // is told only "Tool was executed but the invocation failed" — and these
      // messages exist to be read and acted on.
      if (error instanceof CapabilityError) {
        return serialise(toolName, {
          ok: false,
          error: { code: error.code, message: error.message },
        })
      }
      // Any other thrown value is a bug in the page. Log the full error for
      // debugging; return only a neutral message that names the tool.
      console.error("[agent-ui]", error)
      return serialise(toolName, {
        ok: false,
        error: {
          code: "internal",
          message: `The "${toolName}" tool could not complete.`,
        },
      })
    }
  }
}

function createListTool(registry: CapabilityRegistry): AgentTool {
  return {
    name: "ui_list",
    description:
      "List the agent-operable UI elements on the page: the page title, and for each element its id, kind, label, description, actions, current state, and nested children. Call this first to discover valid target ids. Pass target to list one element's children instead — the recovery when an element reports childrenOmitted. A cut listing reports window: offset, returned and total — walk by advancing offset by window.returned. A listed state is current; use ui_read for detail the digest leaves out.",
    scope: { on: "page" },
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description:
            "An element id: given, the tool lists that element's children instead of the whole page. Use it on an element that reports childrenOmitted.",
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Index of the first element to return. Defaults to 0.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          description: "How many elements to return. Defaults to as many as fit.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: makeExecutor("ui_list", async (input) => {
      const target = expectOptionalString(input, "target")
      const offset = expectOptionalInteger(input, "offset", 0)
      const limit = expectOptionalInteger(input, "limit", 1)
      if (target !== undefined) {
        // Resolve through the registry so an unknown id is refused with the
        // same correctable message every other tool produces. `require`
        // rather than `read`: a targeted listing carries the children, not
        // the target's state, and reading a five-hundred-row table to
        // discard it would put the table's size on this call's cost.
        registry.require(target)
      }
      return serialiseListDocument(buildListDocument(registry, target), offset, limit)
    }),
  }
}

/**
 * An optional integer tool argument. The JSON Schema already declares the
 * shape; this enforces it at execution time, where a host may not have.
 */
function expectOptionalInteger(
  input: Record<string, unknown>,
  key: string,
  minimum: number,
): number | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new CapabilityError(
      "invalid_input",
      `"${key}" must be a whole number of at least ${minimum}.`,
    )
  }
  return value
}

/** The window reported next to a state whose largest list was cut to fit. */
interface ReadWindow {
  field: string
  offset: number
  returned: number
  total: number
}

/**
 * Serialise a `ui_read` result, windowing the state's largest array field when
 * the whole state exceeds the output budget.
 *
 * A read that answers a large table with nothing at all is the one answer that
 * cannot be acted on, so an oversized state is not refused outright: the
 * largest array field — measured by serialised length, the same measure as the
 * budget — is cut to the largest window that fits, and the window is reported
 * next to the state. `window.total` is the true total and `offset` walks the
 * list, so paging never has to be discovered by trial. A state with no array
 * to window cannot be reduced and is returned as-is, refusal still possible;
 * a state whose entries cannot fit even alone is genuinely unrepresentable
 * and is refused, naming the field.
 */
function serialiseReadState(
  target: string,
  state: CapabilityState,
  offset: number | undefined,
  limit: number | undefined,
): string {
  let best: { field: string; array: unknown[]; size: number } | undefined
  for (const [key, value] of Object.entries(state)) {
    if (!Array.isArray(value)) continue
    const size = JSON.stringify(value).length
    if (best === undefined || size > best.size) {
      best = { field: key, array: value, size }
    }
  }

  // No list to window: nothing can be reduced, so the state goes out as-is.
  if (best === undefined) {
    return serialise("ui_read", { ok: true, target, action: "read", state })
  }
  const { field, array } = best

  const total = array.length
  // An offset past the end is not an error: the empty window reports the true
  // total, so the agent learns where the list ends.
  const start = Math.min(offset ?? 0, total)
  const remaining = total - start
  const requested = limit !== undefined ? Math.min(limit, remaining) : remaining

  const windowed = (count: number): Record<string, unknown> => ({
    ok: true,
    target,
    action: "read",
    state: { ...state, [field]: array.slice(start, start + count) },
    window: { field, offset: start, returned: count, total } satisfies ReadWindow,
  })
  const fits = (count: number): boolean =>
    JSON.stringify(windowed(count)).length <= MAX_OUTPUT

  // Asked for the list from the start with no cap: the state can go out whole,
  // with no window key, when it fits.
  if (start === 0 && requested === total) {
    const json = JSON.stringify({ ok: true, target, action: "read", state })
    if (json.length <= MAX_OUTPUT) return json
  }

  if (fits(requested)) return JSON.stringify(windowed(requested))

  // A single entry that cannot fit even alone is a genuinely unrepresentable
  // state, not something to paper over with an empty window.
  if (!fits(1)) {
    return JSON.stringify({
      ok: false,
      error: {
        code: "output_too_large",
        message: `The state of "${target}" cannot be returned: even a single entry of its "${field}" list does not fit in this page's ${MAX_OUTPUT} character output budget.`,
      },
    })
  }

  // Bisect for the largest window that fits: `fits(low)` holds, `fits(high)`
  // does not, and the loop ends with them adjacent.
  let low = 1
  let high = requested
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (fits(mid)) low = mid
    else high = mid
  }
  return JSON.stringify(windowed(low))
}

function createReadTool(registry: CapabilityRegistry): AgentTool {
  return {
    name: "ui_read",
    description:
      "Read the current semantic state of one UI element by id. Use ui_list first to discover valid ids. When the state's largest list is long, it comes back windowed: window reports the list field, the offset, how many entries returned, and the true total. window.returned is authoritative: the output budget can clamp a limit short. Walk by advancing offset by window.returned — never by the limit you asked for — until offset + returned reaches total.",
    scope: { on: "any-capability" },
    inputSchema: {
      type: "object",
      properties: {
        target: TARGET_PROPERTY,
        offset: {
          type: "integer",
          minimum: 0,
          description:
            "Index of the first entry to return from this element's largest list. Defaults to 0.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          description:
            "How many entries of that list to return. Defaults to as many as fit; the output budget may clamp it, and window.returned reports what actually returned.",
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: makeExecutor("ui_read", async (input) => {
      const target = expectString(input, "target")
      const offset = expectOptionalInteger(input, "offset", 0)
      const limit = expectOptionalInteger(input, "limit", 1)
      // The registry owns target resolution and its rejection message.
      const state = registry.read(target)
      return serialiseReadState(target, state, offset, limit)
    }),
  }
}

function createKindTool(
  registry: CapabilityRegistry,
  def: KindToolDef,
): AgentTool {
  return {
    name: def.name,
    description: def.description,
    scope: { on: "kind", kind: def.kind, action: def.action },
    inputSchema: buildInputSchema(def.inputSchema),
    // Every kind tool mutates component state; reads go through ui_read.
    execute: makeExecutor(def.name, async (input) => {
      const target = expectString(input, "target")
      const actionInput = withoutTarget(input)
      const result = await registry.invoke(target, def.action, actionInput)
      return serialise(def.name, {
        ok: true,
        target,
        action: def.action,
        state: result.state,
        detail: result.detail,
      })
    }),
  }
}

/**
 * Shape an `AgentAction` capability reports through `read()`. `Capability.read`
 * is typed as an open record, so the contract is narrowed here rather than cast.
 */
interface ActionCapabilityState {
  description: string
  inputSchema?: Record<string, unknown>
  requiresConfirmation: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readActionState(capability: Capability): ActionCapabilityState | undefined {
  const state = capability.read()
  if (typeof state.description !== "string" || state.description.length === 0) {
    return undefined
  }
  return {
    description: state.description,
    inputSchema: isRecord(state.inputSchema) ? state.inputSchema : undefined,
    requiresConfirmation: state.requiresConfirmation === true,
  }
}

function createActionTool(
  registry: CapabilityRegistry,
  capability: Capability,
  state: ActionCapabilityState,
): AgentTool {
  const name = actionToolName(capability.id)
  const userInputSchema = state.inputSchema ?? {}

  // A business action tool is bound to exactly one capability, so it carries no
  // `target`: the tool name already identifies what it operates on.
  const properties: Record<string, unknown> = { ...userInputSchema }
  const required = Object.keys(userInputSchema)

  if (state.requiresConfirmation) {
    properties.confirmed = {
      type: "boolean",
      description: "Set to true to confirm this consequential action.",
    }
    required.push("confirmed")
  }

  return {
    name,
    description: state.description,
    scope: { on: "capability", id: capability.id },
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    // Business actions are never read-only.
    execute: makeExecutor(name, async (input) => {
      const result = await registry.invoke(capability.id, "run", input)
      return serialise(name, {
        ok: true,
        target: capability.id,
        action: "run",
        state: result.state,
        detail: result.detail,
      })
    }),
  }
}

/** Every tool that the currently mounted capabilities justify. */
export function createAgentTools(registry: CapabilityRegistry): AgentTool[] {
  const tools: AgentTool[] = [createListTool(registry), createReadTool(registry)]

  const mountedKinds = new Set(registry.listKinds())
  for (const def of KIND_TOOLS) {
    if (mountedKinds.has(def.kind)) {
      tools.push(createKindTool(registry, def))
    }
  }

  for (const capability of registry.listByKind("action")) {
    const state = readActionState(capability)
    if (!state) {
      // Only AgentAction produces this kind, and it validates its own props, so
      // this means something else registered kind "action" with a state that is
      // not an action. Report it and expose no tool for it rather than
      // advertising an action with no description.
      console.error(
        "[agent-ui]",
        `Capability "${capability.id}" registered as kind "action" without a description.`,
      )
      continue
    }
    tools.push(createActionTool(registry, capability, state))
  }

  return tools
}
