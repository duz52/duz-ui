/**
 * Tool argument forms — pure logic, no React.
 *
 * The gallery's tool runner renders a real form for an `AgentTool` instead of
 * making the user hand-edit JSON, and pre-fills arguments that are valid on
 * the first Run. `fieldsFor` derives generic fields from the tool's JSON
 * Schema and overrides them with the live capability state where the gallery
 * knows the kind first-hand; `initialArguments` produces the argument object
 * for the first Run.
 */

import type { CapabilityState } from "@/lib/agent-ui/capability"
import type { AgentTool } from "@/lib/agent-ui/tools"

export type Choice = { value: string; label: string; disabled?: boolean }

export type Field =
  | { name: string; description?: string; type: "text" }
  | {
      name: string
      description?: string
      type: "number"
      min?: number
      max?: number
      step?: number
    }
  | { name: string; description?: string; type: "boolean" }
  | { name: string; description?: string; type: "choice"; options: Choice[] }
  | {
      name: string
      description?: string
      type: "multi-choice"
      options: Choice[]
    }
  | { name: string; description?: string; type: "string-list" }
  | {
      name: string
      description?: string
      type: "number-list"
      length: number
      min?: number
      max?: number
      step?: number
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry): entry is string => typeof entry === "string")
  )
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((entry): entry is number => typeof entry === "number")
  )
}

/** One option as a capability's read state reports it. */
interface OptionEntry {
  value: string
  label: string | undefined
  disabled: boolean
}

/**
 * Read an option list (a tabs', select's or accordion's entries) from a
 * capability state. Returns undefined when the key is missing or an entry is
 * not the expected shape; the caller then keeps the generic field.
 */
function readOptionList(
  state: CapabilityState,
  key: string,
): OptionEntry[] | undefined {
  const raw = state[key]
  if (!Array.isArray(raw)) return undefined
  const options: OptionEntry[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) return undefined
    const value = entry.value
    if (typeof value !== "string") return undefined
    options.push({
      value,
      label: typeof entry.label === "string" ? entry.label : undefined,
      disabled: entry.disabled === true,
    })
  }
  return options
}

/** One column as a data-table capability's read state reports it. */
interface ColumnEntry {
  id: string
  label: string | undefined
  sortable: boolean
  filterable: boolean
}

function readColumnList(state: CapabilityState): ColumnEntry[] | undefined {
  const raw = state.columns
  if (!Array.isArray(raw)) return undefined
  const columns: ColumnEntry[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) return undefined
    const id = entry.id
    if (typeof id !== "string") return undefined
    columns.push({
      id,
      label: typeof entry.label === "string" ? entry.label : undefined,
      sortable: entry.sortable === true,
      filterable: entry.filterable === true,
    })
  }
  return columns
}

function toChoice(option: OptionEntry): Choice {
  const choice: Choice = {
    value: option.value,
    label: option.label ?? option.value,
  }
  if (option.disabled) choice.disabled = true
  return choice
}

function descriptionOf(schema: unknown): string | undefined {
  if (!isRecord(schema)) return undefined
  const description = schema.description
  return typeof description === "string" ? description : undefined
}

/** Generic field derivation from one JSON Schema property. */
function fieldFromSchema(name: string, schema: unknown): Field {
  const description = descriptionOf(schema)
  if (!isRecord(schema)) return { name, description, type: "text" }

  if (Array.isArray(schema.enum)) {
    const options = schema.enum
      .filter((entry): entry is string => typeof entry === "string")
      .map((value) => ({ value, label: value }))
    if (options.length > 0) {
      return { name, description, type: "choice", options }
    }
  }

  const { type, items } = schema
  if (type === "boolean") {
    return { name, description, type: "boolean" }
  }
  if (type === "integer" || type === "number") {
    const field: Field = { name, description, type: "number" }
    if (typeof schema.minimum === "number") field.min = schema.minimum
    if (typeof schema.maximum === "number") field.max = schema.maximum
    return field
  }
  if (type === "array" && isRecord(items)) {
    if (items.type === "string") {
      return { name, description, type: "string-list" }
    }
    if (items.type === "number") {
      return { name, description, type: "number-list", length: 1 }
    }
  }
  return { name, description, type: "text" }
}

/**
 * Builds one field from the live capability state, or returns undefined when
 * the state does not carry the expected shape; the caller keeps the generic
 * schema-derived field.
 */
type FieldBuilder = (
  name: string,
  description: string | undefined,
  state: CapabilityState,
) => Field | undefined

interface FieldOverride {
  /** The schema property this override replaces. */
  property: string
  build: FieldBuilder
}

function choiceList(key: string): FieldBuilder {
  return (name, description, state) => {
    const options = readOptionList(state, key)
    if (options === undefined) return undefined
    return {
      name,
      description,
      type: "choice",
      options: options.map(toChoice),
    }
  }
}

function multiChoiceList(key: string): FieldBuilder {
  return (name, description, state) => {
    const options = readOptionList(state, key)
    if (options === undefined) return undefined
    return {
      name,
      description,
      type: "multi-choice",
      options: options.map(toChoice),
    }
  }
}

function columnChoice(filter?: "sortable" | "filterable"): FieldBuilder {
  return (name, description, state) => {
    const columns = readColumnList(state)
    if (columns === undefined) return undefined
    const selectable =
      filter === undefined
        ? columns
        : columns.filter((column) => column[filter])
    return {
      name,
      description,
      type: "choice",
      options: selectable.map((column) => ({
        value: column.id,
        label: column.label ?? column.id,
      })),
    }
  }
}

function rowsMultiChoice(
  name: string,
  description: string | undefined,
  state: CapabilityState,
): Field | undefined {
  const raw = state.rows
  if (!Array.isArray(raw)) return undefined
  const options: Choice[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) return undefined
    const id = entry.id
    if (typeof id !== "string") return undefined
    options.push({ value: id, label: id })
  }
  return { name, description, type: "multi-choice", options }
}

function pageField(
  name: string,
  description: string | undefined,
  state: CapabilityState,
): Field | undefined {
  const pageCount = state.pageCount
  if (typeof pageCount !== "number" || pageCount < 1) return undefined
  return { name, description, type: "number", min: 1, max: pageCount }
}

function sliderField(
  name: string,
  description: string | undefined,
  state: CapabilityState,
): Field | undefined {
  const value = state.value
  const { min, max, step } = state
  if (!isNumberArray(value) || value.length === 0) return undefined
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    typeof step !== "number"
  ) {
    return undefined
  }
  return {
    name,
    description,
    type: "number-list",
    length: value.length,
    min,
    max,
    step,
  }
}

/**
 * Field overrides keyed by tool name.
 *
 * The gallery knows these kinds first-hand — exactly as an agent learns the
 * same facts by calling `ui_read` — so each entry replaces the generic
 * schema-derived field with one built from the live capability state. When
 * the state is absent or does not carry the expected shape, `fieldsFor`
 * falls back to the generic field.
 */
const FIELD_OVERRIDES: Record<string, FieldOverride> = {
  tabs_select: { property: "value", build: choiceList("tabs") },
  select_choose: { property: "value", build: choiceList("options") },
  multi_select_set: { property: "values", build: multiChoiceList("options") },
  accordion_expand: { property: "value", build: choiceList("items") },
  accordion_collapse: { property: "value", build: choiceList("items") },
  table_filter: { property: "column", build: columnChoice("filterable") },
  table_sort: { property: "column", build: columnChoice("sortable") },
  table_set_column_visibility: { property: "column", build: columnChoice() },
  table_select_rows: { property: "rowIds", build: rowsMultiChoice },
  table_set_page: { property: "page", build: pageField },
  slider_set: { property: "value", build: sliderField },
}

/**
 * Apply the tool's field override, if any, from the live state. Any absence
 * or shape mismatch keeps the generic schema-derived field.
 */
function overrideField(
  toolName: string,
  name: string,
  generic: Field,
  state: CapabilityState | null,
): Field | undefined {
  if (state === null) return undefined
  const override = FIELD_OVERRIDES[toolName]
  if (override === undefined || override.property !== name) return undefined
  return override.build(name, generic.description, state)
}

export function fieldsFor(
  tool: AgentTool,
  state: CapabilityState | null,
): Field[] {
  const fields: Field[] = []
  for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
    if (name === "target") continue
    const generic = fieldFromSchema(name, schema)
    fields.push(overrideField(tool.name, name, generic, state) ?? generic)
  }
  return fields
}

/**
 * Schema-default fallback for one property: the schema's `default` when
 * present, else a zero value for the declared type, else null.
 */
export function defaultValueFor(schema: unknown): unknown {
  if (!isRecord(schema)) return null
  if (schema.default !== undefined) return schema.default
  switch (schema.type) {
    case "string":
      return ""
    case "boolean":
      return false
    case "integer":
    case "number":
      return 0
    case "array":
      return []
    default:
      return null
  }
}

function currentString(
  state: CapabilityState,
  key: string,
): string | undefined {
  const value = state[key]
  return typeof value === "string" ? value : undefined
}

/** Seeds one tool's arguments from the live state, over the schema defaults. */
type ArgumentSeeder = (state: CapabilityState) => Record<string, unknown>

/**
 * First-run argument seeds keyed by tool name: the value that visibly changes
 * something when the user hits Run without typing. Each seeder receives the
 * live capability state and returns only the properties it can fill validly;
 * every property it omits keeps its schema default, and a missing or
 * malformed state shape seeds nothing.
 */
const ARGUMENT_SEEDS: Record<string, ArgumentSeeder> = {
  tabs_select: (state) => {
    const tabs = readOptionList(state, "tabs")
    if (tabs === undefined || tabs.length === 0) return {}
    const current = currentString(state, "value")
    const value =
      tabs.find((tab) => tab.value !== current)?.value ??
      current ??
      tabs[0]?.value
    return value === undefined ? {} : { value }
  },
  select_choose: (state) => {
    const options = readOptionList(state, "options")
    if (options === undefined) return {}
    const current = currentString(state, "value")
    const usable = options.filter((option) => !option.disabled)
    const value =
      usable.find((option) => option.value !== current)?.value ??
      usable[0]?.value
    return value === undefined ? {} : { value }
  },
  multi_select_set: (state) => {
    return isStringArray(state.value) ? { values: state.value } : {}
  },
  checkbox_set: (state) => {
    const checked = state.checked
    if (typeof checked !== "boolean" && checked !== "indeterminate") return {}
    return { checked: checked !== true }
  },
  input_set_value: (state) => {
    const value = currentString(state, "value")
    return value === undefined ? {} : { value }
  },
  accordion_expand: (state) => {
    const items = readOptionList(state, "items")
    if (items === undefined || items.length === 0) return {}
    const expanded = isStringArray(state.value) ? state.value : []
    const value =
      items.find((item) => !expanded.includes(item.value))?.value ??
      items[0]?.value
    return value === undefined ? {} : { value }
  },
  accordion_collapse: (state) => {
    const items = readOptionList(state, "items")
    if (items === undefined || items.length === 0) return {}
    const expanded = isStringArray(state.value) ? state.value : []
    const value =
      items.find((item) => expanded.includes(item.value))?.value ??
      items[0]?.value
    return value === undefined ? {} : { value }
  },
  table_filter: (state) => {
    const columns = readColumnList(state)
    if (columns === undefined) return {}
    const column = columns.find((entry) => entry.filterable)?.id
    return column === undefined ? {} : { column, value: "" }
  },
  table_sort: (state) => {
    const columns = readColumnList(state)
    if (columns === undefined) return {}
    const column = columns.find((entry) => entry.sortable)?.id
    return column === undefined
      ? { direction: "asc" }
      : { column, direction: "asc" }
  },
  table_set_page: (state) => {
    const page = state.page
    return typeof page === "number" && Number.isInteger(page) && page >= 1
      ? { page }
      : {}
  },
  table_set_column_visibility: (state) => {
    const columns = readColumnList(state)
    const column = columns?.[0]?.id
    return column === undefined ? {} : { column, visible: false }
  },
  table_select_rows: (state) => {
    return isStringArray(state.selectedRowIds)
      ? { rowIds: state.selectedRowIds }
      : {}
  },
  slider_set: (state) => {
    const value = state.value
    return isNumberArray(value) && value.length > 0 ? { value } : {}
  },
  date_set: (state) => {
    return isStringArray(state.value) ? { value: state.value } : {}
  },
}

export function initialArguments(
  tool: AgentTool,
  target: string | null,
  state: CapabilityState | null,
): Record<string, unknown> {
  const properties = tool.inputSchema.properties
  const args: Record<string, unknown> = {}

  // The runner renders the target as its own element picker; every other
  // property starts from its schema default.
  if ("target" in properties) {
    args.target = target
  }
  for (const name of Object.keys(properties)) {
    if (name === "target") continue
    args[name] = defaultValueFor(properties[name])
  }

  if (state !== null) {
    const seed = ARGUMENT_SEEDS[tool.name]
    if (seed !== undefined) {
      Object.assign(args, seed(state))
    }
  }

  // A consequential business action is never pre-confirmed.
  if (tool.scope.on === "capability" && "confirmed" in properties) {
    args.confirmed = false
  }

  return args
}
