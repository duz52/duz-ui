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

import { CapabilityError, type Capability } from "./capability"
import type { CapabilityRegistry } from "./registry"
import { expectString } from "./validate"

export interface AgentTool {
  name: string
  description: string
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
      "Set the selected date or dates of a calendar element, replacing the previous selection. The value is an array of YYYY-MM-DD strings whose length depends on the calendar's mode: single mode takes zero or one date (an empty array clears the selection), multiple mode takes any number of dates, and range mode takes exactly two dates, start then end. Call ui_read on the target to see the current mode, value and bounds.",
    inputSchema: {
      value: {
        type: "array",
        items: { type: "string" },
        description:
          "Dates as YYYY-MM-DD strings, replacing the selection. Length must match the mode: single 0-1, multiple any, range exactly 2 (start, end).",
      },
    },
  },
]

/**
 * Agent context budget (Chrome WebMCP guidance): a tool output above roughly
 * 1.5K characters makes agents trip their own guardrails.
 */
const MAX_OUTPUT = 1500

/**
 * Serialise a tool result for the agent. WebMCP requires string output. When
 * the payload exceeds the budget the envelope stays valid JSON and says so,
 * rather than handing the agent a truncated fragment it cannot parse.
 */
function serialise(value: unknown): string {
  const json = JSON.stringify(value)
  if (json.length <= MAX_OUTPUT) return json
  return JSON.stringify({
    ok: true,
    truncated: true,
    reason: `The result is ${json.length} characters, above the ${MAX_OUTPUT} character tool output budget. Narrow the request, for example by filtering or paging.`,
  })
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
        return serialise({
          ok: false,
          error: { code: error.code, message: error.message },
        })
      }
      // Any other thrown value is a bug in the page. Log the full error for
      // debugging; return only a neutral message that names the tool.
      console.error("[agent-ui]", error)
      return serialise({
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
      "List the agent-operable UI elements currently on the page, with their id, kind, label and available actions. Call this first to discover valid target ids.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: makeExecutor("ui_list", async () => {
      const capabilities = registry.describeAll()
      return serialise({ ok: true, action: "list", state: { capabilities } })
    }),
  }
}

function createReadTool(registry: CapabilityRegistry): AgentTool {
  return {
    name: "ui_read",
    description:
      "Read the current semantic state of one UI element by id. Use ui_list first to discover valid ids.",
    inputSchema: {
      type: "object",
      properties: { target: TARGET_PROPERTY },
      required: ["target"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: makeExecutor("ui_read", async (input) => {
      const target = expectString(input, "target")
      // The registry owns target resolution and its rejection message.
      const state = registry.read(target)
      return serialise({ ok: true, target, action: "read", state })
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
    inputSchema: buildInputSchema(def.inputSchema),
    // Every kind tool mutates component state; reads go through ui_read.
    execute: makeExecutor(def.name, async (input) => {
      const target = expectString(input, "target")
      const actionInput = withoutTarget(input)
      const result = await registry.invoke(target, def.action, actionInput)
      return serialise({
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
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    // Business actions are never read-only.
    execute: makeExecutor(name, async (input) => {
      const result = await registry.invoke(capability.id, "run", input)
      return serialise({
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
