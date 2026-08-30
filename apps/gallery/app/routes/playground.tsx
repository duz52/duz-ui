import * as React from "react"

import type { Route } from "./+types/playground"
import { JsonBlock } from "@/components/site/json-block"
import { KindBadge } from "@/components/site/kind-badge"
import { PageHeader } from "@/components/site/page-header"
import { ToolRunner } from "@/components/site/tool-runner"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/base/ui/accordion"
import { Button } from "@/components/base/ui/button"
import { Calendar } from "@/components/base/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/base/ui/card"
import { Checkbox } from "@/components/base/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/base/ui/collapsible"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/base/ui/data-table"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/base/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"
import { Slider } from "@/components/base/ui/slider"
import { Switch } from "@/components/base/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/ui/tabs"
import { Textarea } from "@/components/base/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/base/ui/toggle-group"
import { ORDERS, type Order } from "@/data/orders"
import { AgentAction } from "@/lib/agent-ui/agent-action"
import type { CapabilityState } from "@/lib/agent-ui/capability"
import { getCapabilityRegistry } from "@/lib/agent-ui/registry"
import { useCapabilities } from "@/lib/agent-ui/use-capabilities"
import { cn } from "@/lib/utils"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Playground — Agent UI" }]
}

const SECTION_HEADING =
  "font-mono text-xs uppercase tracking-wider text-muted-foreground"

// One varied slice of the demo orders — every status appears, so the
// table's filter and sort actions have something to do.
const RECENT_ORDERS: Order[] = [
  ...ORDERS.slice(0, 2),
  ...ORDERS.slice(10, 12),
  ...ORDERS.slice(22, 24),
  ...ORDERS.slice(34, 36),
]

const RECENT_ORDER_COLUMNS: DataTableColumn<Order>[] = [
  { id: "id", header: "ID", accessor: (o) => o.id },
  { id: "customer", header: "Customer", accessor: (o) => o.customer },
  { id: "status", header: "Status", accessor: (o) => o.status },
  {
    id: "total",
    header: "Total",
    accessor: (o) => o.total,
    cell: (o) => `$${o.total.toFixed(2)}`,
  },
]

/**
 * One live surface on the workbench: mono id in the corner, kind badge and
 * title up top, the control itself, and one line of caption.
 */
function CapabilityCard({
  id,
  kind,
  title,
  caption,
  span,
  children,
}: {
  id: string
  kind: string
  title: string
  caption: string
  span?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className={cn(span && "sm:col-span-2")}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KindBadge kind={kind} />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <CardAction>
          <span className="font-mono text-[11px] text-muted-foreground">
            {id}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <p className="text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  )
}

const isString = (value: unknown): value is string => typeof value === "string"

const isNumber = (value: unknown): value is number => typeof value === "number"

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  )
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  )
}

// One formatter per kind, each returning the single fact that matters for
// that kind. A formatter returns null when the state's shape does not match
// what its kind reports; digestFor then falls back to a key count rather
// than guess.
function digestTabs(state: CapabilityState): string | null {
  if (!isString(state.value) || !Array.isArray(state.tabs)) return null
  return `value: "${state.value}"`
}

function digestSelect(state: CapabilityState): string | null {
  const value = state.value
  if (!isString(value) && value !== null) return null
  if (!Array.isArray(state.options)) return null
  return `value: ${JSON.stringify(value)}`
}

function digestMultiSelect(state: CapabilityState): string | null {
  if (!isStringArray(state.value) || !Array.isArray(state.options)) return null
  return `${state.value.length} of ${state.options.length} selected`
}

function digestCheckbox(state: CapabilityState): string | null {
  if (state.checked === true) return "checked"
  if (state.checked === false) return "unchecked"
  if (state.checked === "indeterminate") return "indeterminate"
  return null
}

function digestInput(state: CapabilityState): string | null {
  if (!isString(state.value)) return null
  if (state.value === "") return "empty"
  const text =
    state.value.length > 28 ? `${state.value.slice(0, 27)}…` : state.value
  return `"${text}"`
}

function digestAccordion(state: CapabilityState): string | null {
  if (!isStringArray(state.value) || !Array.isArray(state.items)) return null
  return `${state.value.length} of ${state.items.length} expanded`
}

function digestSlider(state: CapabilityState): string | null {
  if (
    !isNumberArray(state.value) ||
    !isNumber(state.min) ||
    !isNumber(state.max)
  ) {
    return null
  }
  if (state.value.length !== 1) return null
  const value = state.value[0]
  if (value === undefined) return null
  return `${value} (${state.min}–${state.max})`
}

function digestDate(state: CapabilityState): string | null {
  if (!isString(state.mode)) return null
  const value = state.value
  if (value === null || value === undefined) return `${state.mode} · none`
  // The calendar erases every mode to one shape: value is an array of
  // YYYY-MM-DD strings, empty when nothing is selected.
  if (!isStringArray(value)) return null
  const [first] = value
  if (first === undefined) return `${state.mode} · none`
  return value.length === 1
    ? `${state.mode} · ${first}`
    : `${state.mode} · ${value.length} dates`
}

function digestOpen(state: CapabilityState): string | null {
  if (typeof state.open !== "boolean") return null
  return state.open ? "open" : "closed"
}

function digestDataTable(state: CapabilityState): string | null {
  const { rowCount, totalRowCount, page, pageCount, selectedRowIds } = state
  if (
    !isNumber(rowCount) ||
    !isNumber(totalRowCount) ||
    !isNumber(page) ||
    !isNumber(pageCount) ||
    !isStringArray(selectedRowIds)
  ) {
    return null
  }
  return `${rowCount} of ${totalRowCount} rows · page ${page}/${pageCount} · ${selectedRowIds.length} selected`
}

function digestProgress(state: CapabilityState): string | null {
  if (!isNumber(state.value) || !isNumber(state.max)) return null
  return `${state.value} / ${state.max}`
}

function digestAction(state: CapabilityState): string | null {
  if (!isString(state.description)) return null
  return "business action"
}

const DIGEST_BY_KIND: Record<
  string,
  (state: CapabilityState) => string | null
> = {
  tabs: digestTabs,
  select: digestSelect,
  "multi-select": digestMultiSelect,
  checkbox: digestCheckbox,
  input: digestInput,
  accordion: digestAccordion,
  slider: digestSlider,
  date: digestDate,
  dialog: digestOpen,
  disclosure: digestOpen,
  "data-table": digestDataTable,
  progress: digestProgress,
  action: digestAction,
}

/** The digest line for one row; a mismatched shape degrades to a key count. */
function digestFor(kind: string, state: CapabilityState): string {
  const digest = DIGEST_BY_KIND[kind]?.(state) ?? null
  if (digest !== null) return digest
  const count = Object.keys(state).length
  return `${count} ${count === 1 ? "key" : "keys"}`
}

/**
 * Live view of every capability on the page. Collapsed, each row is one
 * line — identity, kind and a one-line digest of the current state —
 * refreshed as the visitor drives the controls by hand. Expanding a row
 * shows the full state, and the per-row "read" button demonstrates the
 * on-demand path an agent takes.
 */
function CapabilityInspector(): React.JSX.Element {
  const capabilities = useCapabilities()
  const registry = getCapabilityRegistry()
  // `undefined` for an element that unregistered between the snapshot and
  // the read — the row then shows no digest rather than the page failing.
  const [states, setStates] = React.useState<(CapabilityState | undefined)[]>([])
  const [read, setRead] = React.useState<{
    id: string
    text: string
    failed: boolean
  } | null>(null)

  // Two properties of the registry shape this effect:
  //
  // 1. It has no dependency array. The registry only notifies when the *set*
  //    of capabilities changes, never when one changes value, so a
  //    subscription alone would miss every hand-driven edit. Running after
  //    every commit of this page's tree means the capabilities' layout
  //    effects have already stored the fresh read closures, so
  //    `registry.read` returns the state of the commit that just happened.
  //    Mounting and unmounting arrive through `useCapabilities`, which
  //    subscribes to `registry.subscribe` via `useSyncExternalStore`.
  // 2. The work is bounded. It is proportional to the fixed set of
  //    capabilities mounted on this one page — fourteen small objects — and
  //    never to traffic, history or conversation length. The setter fires
  //    only when the serialised snapshot actually differs, so the loop
  //    terminates instead of scheduling renders forever.
  React.useEffect(() => {
    // `get`, not `read`: `capabilities` is a snapshot and the registry is
    // live, so an id can vanish between the two. A live view showing nothing
    // for a gone element is correct; throwing would take the page down. The
    // per-row "read" button below deliberately uses the throwing form,
    // because that one is demonstrating the agent's own path.
    const next = capabilities.map((cap) => registry.get(cap.id)?.read())
    setStates((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    )
  })

  function handleRead(id: string): void {
    try {
      setRead({
        id,
        text: JSON.stringify(registry.read(id), null, 2),
        failed: false,
      })
    } catch (e) {
      // A CapabilityError here is the honest answer to a read of an id that
      // unmounted between render and click — show its message as-is.
      setRead({
        id,
        text: e instanceof Error ? e.message : String(e),
        failed: true,
      })
    }
  }

  if (capabilities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No agent-operable elements are mounted.
      </p>
    )
  }

  const kindCount = new Set(capabilities.map((cap) => cap.kind)).size

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-xs leading-relaxed text-muted-foreground">
          What an agent sees when it looks at this page: every element it can
          operate, and the state it can read.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {capabilities.length} elements · {kindCount} kinds
        </p>
      </div>
      <div className="space-y-1.5">
        {capabilities.map((cap, index) => {
          const state = states[index]
          return (
            <details
              key={cap.id}
              className="group rounded-lg border border-border"
            >
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                >
                  <path d="m6 3 5 5-5 5" />
                </svg>
                <KindBadge kind={cap.kind} />
                <code className="shrink-0 font-mono text-[11px]">{cap.id}</code>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {cap.label ?? "—"}
                </span>
                {state !== undefined && (
                  <span className="shrink-0 text-[10px] font-medium text-foreground">
                    {digestFor(cap.kind, state)}
                  </span>
                )}
              </summary>
              <div className="space-y-2.5 border-t border-border px-2 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {cap.actions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        no actions — read-only
                      </span>
                    ) : (
                      cap.actions.map((action) => (
                        <code
                          key={action}
                          className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {action}
                        </code>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRead(cap.id)}
                    aria-label={`Read the current state of ${cap.id}`}
                    className="shrink-0 rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    read
                  </button>
                </div>
                {state !== undefined && (
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      state
                    </p>
                    <JsonBlock payload={JSON.stringify(state)} />
                  </div>
                )}
                {read?.id === cap.id && (
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      read()
                    </p>
                    <JsonBlock
                      payload={read.text}
                      tone={read.failed ? "error" : "default"}
                    />
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

export default function Playground(): React.JSX.Element {
  // Every capability's state lives here, the way demo.tsx owns its screen's
  // state. Each hand-driven edit re-renders this tree, which is what lets the
  // inspector's after-every-commit effect see the fresh values.
  const [tab, setTab] = React.useState("account")
  const [shipping, setShipping] = React.useState("standard")
  const [channels, setChannels] = React.useState<string[]>(["email"])
  const [digest, setDigest] = React.useState(false)
  const [autoSave, setAutoSave] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [faq, setFaq] = React.useState<string[]>(["what"])
  const [volume, setVolume] = React.useState<number[]>([50])
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2026, 7, 12),
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // One business function shared by the button's click handler and the agent
  // action: the same semantics, whichever path invokes it.
  function resetForm(): { cleared: string[] } {
    setEmail("")
    setMessage("")
    return { cleared: ["pg-input", "pg-textarea"] }
  }

  return (
    <div className="space-y-8 py-8">
      <PageHeader
        title="Playground"
        description="Every capability kind in the system, mounted live at once, with the semantic state an agent reads and the tools it can call."
      />

      {/* `min-w-0` on the surfaces column: a `1fr` grid track will not shrink
          below its content's min-content width, so the orders table would push
          the console column past the viewport edge. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-4">
          <h2 className={SECTION_HEADING}>Surfaces</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <CapabilityCard
              id="pg-tabs"
              kind="tabs"
              title="Workspace sections"
              caption="The active tab is semantic state; switching it is an agent action."
            >
              <Tabs
                value={tab}
                onValueChange={setTab}
                agent={{ id: "pg-tabs", label: "Workspace sections" }}
              >
                <TabsList>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                </TabsList>
                <TabsContent value="account">Account settings.</TabsContent>
                <TabsContent value="billing">Billing details.</TabsContent>
                <TabsContent value="team">Team members.</TabsContent>
              </Tabs>
            </CapabilityCard>

            <CapabilityCard
              id="pg-select"
              kind="select"
              title="Delivery"
              caption="The chosen option is readable state an agent can set."
            >
              <div className="space-y-1.5">
                <Label htmlFor="playground-shipping">Shipping method</Label>
                <Select
                  value={shipping}
                  // This select has no clear affordance, so a null payload
                  // (Base UI's "cleared" signal) keeps the current value.
                  onValueChange={(value) => setShipping(value ?? shipping)}
                  agent={{ id: "pg-select", label: "Shipping method" }}
                >
                  <SelectTrigger id="playground-shipping" className="w-full">
                    <SelectValue placeholder="Shipping method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="overnight">Overnight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CapabilityCard>

            <CapabilityCard
              id="pg-multi-select"
              kind="multi-select"
              title="Notifications"
              caption="Multiple selections report as an array of the chosen values."
            >
              <ToggleGroup
                multiple
                variant="outline"
                value={channels}
                onValueChange={setChannels}
                aria-label="Notification channels"
                agent={{ id: "pg-multi-select", label: "Notification channels" }}
              >
                <ToggleGroupItem value="email">Email</ToggleGroupItem>
                <ToggleGroupItem value="sms">SMS</ToggleGroupItem>
                <ToggleGroupItem value="push">Push</ToggleGroupItem>
              </ToggleGroup>
            </CapabilityCard>

            <CapabilityCard
              id="pg-checkbox"
              kind="checkbox"
              title="Email digest"
              caption="A boolean the agent can set and read — the same kind as the switch."
            >
              <Label className="flex items-center gap-3">
                <Checkbox
                  checked={digest}
                  onCheckedChange={(v) => setDigest(v === true)}
                  agent={{ id: "pg-checkbox", label: "Weekly email digest" }}
                />
                Send a weekly email digest
              </Label>
            </CapabilityCard>

            <CapabilityCard
              id="pg-switch"
              kind="checkbox"
              title="Editor"
              caption="Same capability kind as the checkbox: the kind is the semantics, not the visual."
            >
              <div className="flex items-center gap-3">
                <Switch
                  id="playground-auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                  agent={{ id: "pg-switch", label: "Auto-save changes" }}
                />
                <Label htmlFor="playground-auto-save">Auto-save changes</Label>
              </div>
            </CapabilityCard>

            <CapabilityCard
              id="pg-dialog"
              kind="dialog"
              title="Order detail"
              caption="Open and close are actions; the agent never reaches into the DOM."
            >
              <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                agent={{ id: "pg-dialog", label: "Order detail" }}
              >
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  View order details
                </Button>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Order ORD-1001</DialogTitle>
                    <DialogDescription>
                      Northwind Traders · $642.50 · pending
                    </DialogDescription>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Placed 2026-08-14 via web. Standard processing.
                  </p>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Close
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CapabilityCard>

            <CapabilityCard
              id="pg-disclosure"
              kind="disclosure"
              title="Shipping details"
              caption="One boolean of state with open, close and toggle actions."
            >
              <Collapsible
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                agent={{ id: "pg-disclosure", label: "Shipping details" }}
              >
                <CollapsibleTrigger render={<Button variant="outline" />}>
                  Show details
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="pt-2 text-sm text-muted-foreground">
                    Ships in two business days from the nearest warehouse.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CapabilityCard>

            <CapabilityCard
              id="pg-input"
              kind="input"
              title="Contact email"
              caption="Free text is readable state; an agent can set the value."
            >
              <div className="space-y-1.5">
                <Label htmlFor="playground-email">Email</Label>
                <Input
                  id="playground-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  agent={{ id: "pg-input", label: "Contact email" }}
                />
              </div>
            </CapabilityCard>

            <CapabilityCard
              id="pg-textarea"
              kind="input"
              title="Contact message"
              caption="Longer text, same input semantics."
            >
              <div className="space-y-1.5">
                <Label htmlFor="playground-message">Message</Label>
                <Textarea
                  id="playground-message"
                  placeholder="How can we help?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  agent={{ id: "pg-textarea", label: "Contact message" }}
                />
              </div>
            </CapabilityCard>

            <CapabilityCard
              id="pg-table"
              kind="data-table"
              title="Recent orders"
              caption="Filter, sort, paginate and toggle columns are the table's intrinsic actions."
              span
            >
              <DataTable
                data={RECENT_ORDERS}
                columns={RECENT_ORDER_COLUMNS}
                getRowId={(o) => o.id}
                pageSize={4}
                // Row selection is off: the per-row checkboxes would register
                // their own generated-id capabilities and drown out the
                // workbench's stable ids. The checkbox kind is already
                // represented by the two dedicated cards.
                enableRowSelection={false}
                agent={{ id: "pg-table", label: "Recent orders" }}
              />
            </CapabilityCard>

            <CapabilityCard
              id="pg-accordion"
              kind="accordion"
              title="FAQ"
              caption="Which items are expanded is readable, settable state."
            >
              <Accordion
                multiple
                value={faq}
                onValueChange={setFaq}
                agent={{ id: "pg-accordion", label: "FAQ" }}
              >
                <AccordionItem value="what">
                  <AccordionTrigger>What is Agent UI?</AccordionTrigger>
                  <AccordionContent>
                    A registry of agent-native React components for real
                    applications.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="add">
                  <AccordionTrigger>How do I add a component?</AccordionTrigger>
                  <AccordionContent>
                    Run <code>npx agent-ui add</code> and pick the component.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CapabilityCard>

            <CapabilityCard
              id="pg-slider"
              kind="slider"
              title="Volume control"
              caption="A bounded number the agent can set precisely."
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="playground-volume">Volume</Label>
                  <span className="text-sm text-muted-foreground">
                    {volume[0]}
                  </span>
                </div>
                <Slider
                  id="playground-volume"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  onValueChange={setVolume}
                  agent={{ id: "pg-slider", label: "Volume" }}
                />
              </div>
            </CapabilityCard>

            <CapabilityCard
              id="pg-progress"
              kind="progress"
              title="Upload"
              caption="Read-only by design: zero actions, so it gets no tool — state an agent can read, never write."
            >
              <Progress
                value={66}
                agent={{ id: "pg-progress", label: "Upload progress" }}
              >
                <ProgressLabel>File upload</ProgressLabel>
                <ProgressValue />
              </Progress>
            </CapabilityCard>

            <CapabilityCard
              id="pg-date"
              kind="date"
              title="Booking"
              caption="The selected date is readable state an agent can set."
            >
              <Calendar
                mode="single"
                defaultMonth={date}
                selected={date}
                onSelect={setDate}
                agent={{ id: "pg-date", label: "Booking date" }}
              />
            </CapabilityCard>

            <CapabilityCard
              id="pg-action"
              kind="action"
              title="Maintenance"
              caption="A plain button is never agent-callable automatically; AgentAction attaches the business semantics."
            >
              <AgentAction
                id="pg-action"
                description="Clear the playground contact form."
                execute={resetForm}
              >
                <Button variant="outline" onClick={resetForm}>
                  Reset the contact form
                </Button>
              </AgentAction>
            </CapabilityCard>
          </div>
        </section>

        <aside className="space-y-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:sticky lg:top-14 lg:z-20 lg:h-[calc(100svh-3.5rem)] lg:overflow-y-auto lg:overscroll-none">
          <h2 className={SECTION_HEADING}>Console</h2>
          <CapabilityInspector />
          <ToolRunner />
        </aside>
      </div>
    </div>
  )
}
