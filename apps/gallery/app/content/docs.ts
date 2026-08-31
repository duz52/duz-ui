/**
 * Agent UI gallery — documentation content.
 *
 * Pure data: no React, no imports. Every code block that quotes the kernel or
 * the adapter is taken verbatim from the source under
 * `packages/registry/src/lib/agent-ui/` and `packages/registry/src/ui/`.
 */

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "list"; items: string[] }

export interface DocPage {
  slug: string
  title: string
  summary: string
  body: DocBlock[]
}

export const DOC_PAGES: DocPage[] = [
  // ---------------------------------------------------------------- 1. introduction
  {
    slug: "introduction",
    title: "Introduction",
    summary:
      "Agent UI ships React components with native agent semantics — one interface, two users.",
    body: [
      {
        type: "p",
        text: "Agent UI is a shadcn-compatible component system where supported interactive components expose their semantic capabilities to WebMCP-capable agents automatically. Run `agent-ui migrate` on an existing shadcn-based site and supported components become agent-operable without application-level WebMCP integration code.",
      },
      {
        type: "p",
        text: "The guiding principle is BASED: clean does not mean closed, minimal does not mean inflexible. The irreducible concepts remain stable while behaviour around them is replaceable.",
      },
      {
        type: "p",
        text: "The irreducible concept is simple: a mounted UI component may expose semantic capabilities that an agent can invoke. Everything else — shadcn, the CLI, codemods, WebMCP — is an adapter around that concept.",
      },
      { type: "h2", text: "Layer chain" },
      {
        type: "code",
        lang: "text",
        code: "React Component\n      ↓\nCapability\n      ↓\nCapability Registry\n      ↓\nProtocol Adapter\n      ↓\nWebMCP",
      },
      {
        type: "p",
        text: "Each layer owns one responsibility and never reconstructs another layer's truth. React owns component state. The capability owns semantic interaction. The registry owns live capability identity and dispatch. The WebMCP adapter owns protocol exposure. The CLI owns installation, the codemod owns migration, and the gallery owns presentation and documentation.",
      },
      {
        type: "p",
        text: "No layer may independently reconstruct another layer's truth. The registry is canonical for live capabilities; React is canonical for component state; the adapter is the only layer that touches `document.modelContext`.",
      },
      { type: "h2", text: "Product promise" },
      {
        type: "p",
        text: "For new applications, `agent-ui add` installs a React component with built-in agent semantics. For existing shadcn applications, `agent-ui migrate` upgrades supported components to the same semantic mechanism.",
      },
      {
        type: "p",
        text: "The resulting application does not contain a parallel agent UI. The existing interface itself becomes agent-operable.",
      },
      {
        type: "code",
        lang: "text",
        code: "One interface. Two users: humans and agents.",
      },
    ],
  },

  // ---------------------------------------------------------------- 2. capability-kernel
  {
    slug: "capability-kernel",
    title: "Capability Kernel",
    summary:
      "Three concepts — capability, identity, registry — that the rest of the system is built on.",
    body: [
      {
        type: "p",
        text: "The kernel contains only three concepts: capability, identity, and registry. A capability is one mounted semantic UI surface. It knows nothing about WebMCP, shadcn, the DOM, the CLI or codemods — only how to report its own semantic state and perform its own semantic actions.",
      },
      { type: "h2", text: "Capability" },
      {
        type: "p",
        text: "A capability declares its supported action names, reads its current state, and invokes actions. The `actions` array is the discovery surface: nothing else reconstructs it.",
      },
      {
        type: "code",
        lang: "ts",
        code: `export type CapabilityState = Record<string, unknown>

export interface Capability<
  State extends CapabilityState = CapabilityState,
  Actions extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  kind: string
  label?: string

  /**
   * Names of the actions this capability supports. Discovery cannot be
   * reconstructed from anywhere else, so the capability declares it.
   */
  actions: readonly (keyof Actions & string)[]

  read(): State

  invoke<Action extends keyof Actions & string>(
    action: Action,
    input: Actions[Action],
  ): Promise<CapabilityResult<State>>
}

export interface CapabilityResult<State extends CapabilityState = CapabilityState> {
  state: State
  /** Optional action-specific return value, e.g. how many rows matched. */
  detail?: unknown
}`,
      },
      {
        type: "p",
        text: "`CapabilityResult.state` is read from the component after the application has committed the transition, so it is canonical post-transition state — never a manufactured echo of the request.",
      },
      { type: "h2", text: "Identity" },
      {
        type: "p",
        text: "Every mounted capability receives exactly one identity. Explicit IDs are preferred: `<DataTable agent={{ id: \"orders\", label: \"Orders\" }} />`. If omitted, Agent UI generates a document-local identity.",
      },
      {
        type: "p",
        text: "Identity must never be reconstructed from visible text, CSS selectors, DOM position, generated class names, or transport metadata. A generated identity is valid only for the current mounted lifetime; identity stability across reloads is not guaranteed unless explicitly provided.",
      },
      {
        type: "code",
        lang: "ts",
        code: `/** Discovery descriptor produced by the registry, never by a component. */
export interface CapabilityDescriptor {
  id: string
  kind: string
  label?: string
  actions: readonly string[]
}

export function describe(capability: Capability): CapabilityDescriptor {
  return {
    id: capability.id,
    kind: capability.kind,
    label: capability.label,
    actions: capability.actions,
  }
}`,
      },
      { type: "h2", text: "Registry" },
      {
        type: "p",
        text: "There is exactly one live registry per document runtime. Registration defines availability; unregistration defines disappearance. There is no reconciliation loop, no DOM scan, and no shadow inventory.",
      },
      {
        type: "code",
        lang: "ts",
        code: `export interface CapabilityRegistry {
  register(capability: Capability): () => void
  get(id: string): Capability | undefined
  list(): Capability[]
  listByKind(kind: string): Capability[]
  listKinds(): string[]
  /** Stable snapshot of every live capability, replaced only when the set changes. */
  describeAll(): CapabilityDescriptor[]
  /** Canonical semantic state of one capability. */
  read(id: string): CapabilityState
  invoke(id: string, action: string, input: unknown): Promise<CapabilityResult>
  /** Notified whenever the set of live capabilities changes. */
  subscribe(listener: () => void): () => void
  /** Document-local identity for a capability that did not supply one. */
  createId(kind: string, seed: string): string
}`,
      },
      {
        type: "p",
        text: "The registry is keyed off a global `Symbol.for` so that module duplication (HMR, multiple bundles) still resolves to one canonical index. `createId` derives a stable id from the capability kind and a seed, stripping characters outside the WebMCP name charset.",
      },
    ],
  },

  // ---------------------------------------------------------------- 3. react-binding
  {
    slug: "react-binding",
    title: "React Binding",
    summary:
      "useCapability translates component-native behaviour into semantic actions. React remains the canonical state owner.",
    body: [
      {
        type: "p",
        text: "React components expose capabilities through `useCapability`. The binding translates component-native behaviour into semantic capability actions. It does not translate WebMCP calls, and it never stores a copy of component state.",
      },
      { type: "h2", text: "The agent prop" },
      {
        type: "p",
        text: "Every agent-operable component accepts an `agent` prop. Pass `agent={{ id, label }}` to give the instance a stable identity and a human-meaningful label. Pass `agent={false}` to opt the instance out of agent exposure entirely.",
      },
      {
        type: "p",
        text: "If `agent` is omitted or set to `true`, the component registers with a generated identity and an optional `defaultLabel`. The binding resolves the config once and feeds the resulting id to the registry.",
      },
      { type: "h2", text: "Action results are read after the commit" },
      {
        type: "p",
        text: "Invoking a callback does not prove the requested state change succeeded. Controlled React components may reject or transform requested values. Therefore an action result reflects canonical component state after the transition.",
      },
      {
        type: "p",
        text: "`useCapability` performs the transition, waits for React to commit, then reads state back. If no commit happens — the application did not accept the transition — the result reports the real, unchanged state instead of a manufactured success.",
      },
      { type: "h2", text: "Real usage: tabs.tsx" },
      {
        type: "p",
        text: "The following is the actual `useCapability` call from the Agent UI Tabs component. React owns `value` and `tabs`; the capability only reads them and forwards `select`.",
      },
      {
        type: "code",
        lang: "tsx",
        code: `useCapability<TabsState, TabsActions>({
  agent,
  kind: "tabs",
  defaultLabel: "Tabs",
  read: () => ({
    value,
    tabs: tabs.map((t) => ({ value: t.value, label: t.label })),
  }),
  actions: {
    select(input) {
      const next = expectString(input, "value")
      const known = tabs.map((t) => t.value)
      if (!known.includes(next)) {
        rejectState(
          \`Tab "\${next}" is not available. Available tabs: \${known.length ? known.join(", ") : "(none)"}.\`,
        )
      }
      setValue(next)
    },
  },
})`,
      },
      {
        type: "p",
        text: "The `read` closure captures the current render's `value` and `tabs`. The binding stores these in refs updated on every commit, so a capability read always sees canonical state rather than the state captured at registration time.",
      },
      {
        type: "p",
        text: "The `select` action validates input, rejects unknown tab values, and calls `setValue`. The result is whatever React committed — if the component is controlled and the parent rejects the value, the result reflects that.",
      },
    ],
  },

  // ---------------------------------------------------------------- 4. webmcp-adapter
  {
    slug: "webmcp-adapter",
    title: "WebMCP Adapter",
    summary:
      "The only layer that touches document.modelContext. Tool count scales with capability kinds, not component instances.",
    body: [
      {
        type: "p",
        text: "WebMCP is an adapter over the capability registry. Components never call `document.modelContext.registerTool()` directly. Only the adapter accesses `document.modelContext`, and it dispatches every agent call back through the registry.",
      },
      { type: "h2", text: "Tool surface" },
      {
        type: "p",
        text: "The adapter exposes two discovery tools that always exist, plus one tool per capability action per kind. The tool names are read from the `KIND_TOOLS` table in `tools.ts` — they are not guessed.",
      },
      {
        type: "code",
        lang: "text",
        code: `Discovery (read-only)
  ui_list          — list every agent-operable element on the page
  ui_read          — read one element's current semantic state
  ui_fill          — set several elements' values in one call

tabs
  tabs_select

select
  select_choose
  select_clear

checkbox
  checkbox_set

dialog
  dialog_open
  dialog_close

input
  input_set_value
  input_clear

data-table
  table_filter
  table_sort
  table_select_rows
  table_select_all_rows
  table_set_page
  table_set_column_visibility

action (AgentAction)
  action_<id>      — one tool per mounted AgentAction`,
      },
      {
        type: "p",
        text: "Every kind tool takes a `target` parameter identifying the capability id, plus the action-specific arguments. `ui_list` is how the agent learns valid ids and which of these tools acts on each of them; `ui_read` is how it inspects detail an action's own result left out.",
      },
      { type: "h2", text: "Tool count scales with kinds, not instances" },
      {
        type: "p",
        text: "A page with three data tables does not produce three filter tools. It produces one `table_filter` tool that accepts a `target` parameter. This keeps the tool surface small and stable as components mount and unmount.",
      },
      {
        type: "code",
        lang: "text",
        code: `Bad — one tool per instance:
  orders_filter
  customers_filter
  products_filter

Good — one tool per kind, target selects the instance:
  table_filter
  with: { "target": "orders" }`,
      },
      { type: "h2", text: "Dispatch path" },
      {
        type: "p",
        text: "An agent action has exactly one execution path. The adapter resolves the target through the registry, invokes the capability action, and returns the post-commit state. There is no DOM querying, no clicking, no synthetic events, and no fallback to browser automation.",
      },
      {
        type: "code",
        lang: "text",
        code: `table_filter
     ↓
target = "orders"
     ↓
registry.invoke("orders", "filter", input)
     ↓
capability.invoke("filter", input)
     ↓
table-native state API
     ↓
React state changes
     ↓
visible UI changes`,
      },
      {
        type: "p",
        text: "If semantic dispatch is impossible — the target does not exist, the action is unsupported, or the input is invalid — the capability rejects the request with a `CapabilityError`. The adapter surfaces that error to the agent; it never compensates with DOM automation.",
      },
      { type: "h2", text: "Feature detection and progressive enhancement" },
      {
        type: "p",
        text: "WebMCP availability is feature-detected. The adapter checks `document.modelContext` and registers nothing when it is absent. Without WebMCP, the app stays ordinary React UI.",
      },
      {
        type: "code",
        lang: "ts",
        code: `export function isWebMCPSupported(): boolean {
  return getModelContext() != null
}

function getModelContext(): WebMCP.ModelContext | undefined {
  if (typeof document === "undefined") return undefined
  return document.modelContext
}`,
      },
      {
        type: "p",
        text: "A failed tool registration must never break human interaction. The adapter catches registration errors, logs them, and continues — the one place a catch is correct, because progressive enhancement requires it.",
      },
    ],
  },

  // ---------------------------------------------------------------- 5. security
  {
    slug: "security",
    title: "Security Boundary",
    summary:
      "Agent-visible state is a semantic subset of component state. Business actions are never inferred from presentation.",
    body: [
      {
        type: "p",
        text: "Agent-visible state must be a semantic subset of component state. The capability layer must not expose arbitrary component props. What the agent sees is what the component's `read()` returns — nothing more.",
      },
      { type: "h2", text: "What must never be exposed automatically" },
      {
        type: "list",
        items: [
          "Hidden records or rows not rendered in the current view",
          "Secrets, tokens, or credentials",
          "Internal IDs not intended for UI semantics",
          "Private metadata or arbitrary callbacks",
          "Unrendered fields or columns the developer marked hidden",
        ],
      },
      {
        type: "p",
        text: "For a data table, visible or explicitly agent-readable columns define the default readable surface. A column marked `agentHidden` is excluded from the capability's `read()` output, even though the underlying data exists in the table model.",
      },
      { type: "h2", text: "Input validation" },
      {
        type: "p",
        text: "Agent input is untrusted. Every invocation validates the target capability exists, the capability supports the action, the argument shape is correct, valid option values are used, and the current component state permits the operation.",
      },
      {
        type: "p",
        text: "Validation rejects invalid requests with messages an agent can self-correct from. It never coerces, never guesses, and never compensates for a missing semantic. Rejection messages name what a valid value looks like, not internal implementation details.",
      },
      { type: "h2", text: "Business actions are explicit" },
      {
        type: "p",
        text: "Agent UI must not infer business semantics from presentation. A generic button cannot know what its `onClick` means, so it never becomes an automatic agent action. No heuristic may infer buy, delete, send, transfer, publish, or submit from button text.",
      },
      {
        type: "p",
        text: "Business actions require explicit semantics through `AgentAction`, which registers a capability of kind `\"action\"`. The adapter exposes it as a dedicated `action_<id>` tool.",
      },
      {
        type: "code",
        lang: "tsx",
        code: `<AgentAction
  id="refresh-orders"
  description="Refresh the current order list."
  execute={refreshOrders}
>
  <Button>Refresh</Button>
</AgentAction>`,
      },
      {
        type: "p",
        text: "Consequential actions opt into confirmation by passing a `confirm` message. The agent must then pass `confirmed: true`; anything else is rejected. The tool's input schema adds the `confirmed` parameter automatically.",
      },
    ],
  },

  // ---------------------------------------------------------------- 6. cli
  {
    slug: "cli",
    title: "CLI",
    summary:
      "init, add, migrate, and doctor — the single developer-facing tooling surface.",
    body: [
      {
        type: "p",
        text: "The CLI is the single developer-facing tooling surface. It is not part of the capability kernel. Commands orchestrate tooling but do not own runtime behaviour.",
      },
      { type: "h2", text: "agent-ui init" },
      {
        type: "p",
        text: "Initialises Agent UI infrastructure. It detects the React project, detects shadcn configuration when available, installs the runtime files (capability kernel and WebMCP adapter), adds required dependencies, and leaves application behaviour unchanged. Running it twice is safe.",
      },
      {
        type: "code",
        lang: "bash",
        code: "npx agent-ui init",
      },
      { type: "h2", text: "agent-ui add" },
      {
        type: "p",
        text: "Installs agent-native components. These components already include their capability bindings, so no codemod is required. Multiple components can be installed in one command.",
      },
      {
        type: "code",
        lang: "bash",
        code: "npx agent-ui add tabs\nnpx agent-ui add select data-table",
      },
      { type: "h2", text: "agent-ui migrate" },
      {
        type: "p",
        text: "Upgrades supported existing shadcn components through codemods. The codemod modifies component implementations, not application usage sites. Before and after migration, application usage remains identical — only the local `tabs.tsx` (and peers) changes.",
      },
      {
        type: "code",
        lang: "bash",
        code: "npx agent-ui migrate",
      },
      {
        type: "p",
        text: "The output reports each component that was upgraded, each that was already agent-native, each that was unsupported, and each that was skipped with a reason.",
      },
      {
        type: "code",
        lang: "text",
        code: `Agent UI migration

✓ tabs
✓ select
✓ checkbox
✓ dialog
✓ input
✓ data-table

Skipped:
- card        presentation-only
- badge       presentation-only
- button      explicit business semantics required

6 components upgraded`,
      },
      {
        type: "p",
        text: "Migration is idempotent. An already-migrated file is recognised by its runtime import prefix and skipped, so running migrate twice produces no change. A locally modified component — one whose top-level statements do not match the stock signature — is reported as unsupported with a reason and left untouched.",
      },
      { type: "h2", text: "agent-ui doctor" },
      {
        type: "p",
        text: "Inspects integration status. It reports facts: which runtime pieces are present, which components are agent-operable, which are presentation-only, and whether WebMCP is available. It never silently repairs architecture.",
      },
      {
        type: "code",
        lang: "bash",
        code: "npx agent-ui doctor",
      },
      {
        type: "code",
        lang: "text",
        code: `Agent UI

Runtime
✓ capability registry
✓ WebMCP adapter

Components
✓ tabs
✓ select
✓ dialog
✓ data-table

Presentation only
- card
- badge

Requires explicit semantics
- button

WebMCP
✓ available`,
      },
    ],
  },

  // ---------------------------------------------------------------- 7. invariants
  {
    slug: "invariants",
    title: "Invariants and Stop Conditions",
    summary:
      "The fifteen invariants the system must uphold, and the conditions under which an implementation must be rejected.",
    body: [
      { type: "h2", text: "Invariants" },
      {
        type: "p",
        text: "These fifteen properties must hold at all times. They are the contract every layer — kernel, binding, adapter, CLI, codemod — is built against.",
      },
      {
        type: "list",
        items: [
          "React/application state is canonical.",
          "Every mounted capability has exactly one identity.",
          "Capability availability equals component availability.",
          "Capability semantics are owned by component bindings.",
          "The registry is the only live capability index.",
          "Only the protocol adapter touches WebMCP.",
          "WebMCP tools dispatch through the registry.",
          "Tool count scales with capability kinds, not instances.",
          "Codemods modify source but do not define semantics.",
          "CLI commands orchestrate tooling but do not own runtime behaviour.",
          "No DOM automation compensates for missing semantics.",
          "Business actions are explicit.",
          "Unsupported components remain ordinary React components.",
          "Running migration repeatedly cannot create additional mechanisms.",
          "Removing Agent UI must not alter unrelated application behaviour.",
        ],
      },
      { type: "h2", text: "Stop conditions" },
      {
        type: "p",
        text: "Reject an implementation when any of these conditions appear. Do not add a compensating layer — replace the broken owner or boundary instead.",
      },
      {
        type: "list",
        items: [
          "React state and Agent UI maintain separate canonical values.",
          "A component and the WebMCP adapter independently define the same semantic action.",
          "Capability identity is reconstructed from DOM presentation.",
          "A codemod embeds WebMCP protocol logic directly into components.",
          "Every component instance registers its own duplicate tool family.",
          "DOM clicking exists as fallback for failed semantic dispatch.",
          "Business meaning is guessed from visible text.",
          "Migration adds wrappers around an obsolete integration instead of removing it.",
          "The same integration bug requires a third special case.",
        ],
      },
    ],
  },
]

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((page) => page.slug === slug)
}

/** Previous and next page in reading order. */
export function getDocNeighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const index = DOC_PAGES.findIndex((page) => page.slug === slug)
  if (index === -1) return {}
  return {
    prev: DOC_PAGES[index - 1],
    next: DOC_PAGES[index + 1],
  }
}
