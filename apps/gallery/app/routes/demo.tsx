import * as React from "react"

import type { Route } from "./+types/demo"
import { PageHeader } from "@/components/site/page-header"
import {
  ScenarioRunner,
  type Scenario,
} from "@/components/site/scenario-runner"
import { ToolRunner } from "@/components/site/tool-runner"
import { AgentAction } from "@/lib/duz-ui/agent-action"
import type { CapabilityState } from "@/lib/duz-ui/capability"
import { Button } from "@/components/radix/ui/button"
import { Checkbox } from "@/components/radix/ui/checkbox"
import { DataTable, type DataTableColumn } from "@/components/radix/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/radix/ui/dialog"
import { Input } from "@/components/radix/ui/input"
import { Label } from "@/components/radix/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/radix/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/radix/ui/tabs"
import { ORDERS, type Order, type OrderStatus } from "@/data/orders"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Demo — Duz UI" }]
}

type StatusFilter = "all" | OrderStatus

/**
 * First visible row id of a data table, read from live capability state — the
 * same read an agent performs with ui_read before selecting a row.
 */
function firstRowId(state: CapabilityState): string {
  // `read()` is typed as an open record, so the shape is narrowed rather than
  // asserted: a cast here would turn a contract change into a TypeError deep
  // in the scenario instead of the step failure it actually is.
  const rows = state.rows
  const first = Array.isArray(rows) ? rows[0] : undefined
  if (
    typeof first !== "object" ||
    first === null ||
    !("id" in first) ||
    typeof first.id !== "string"
  ) {
    throw new Error("The table has no visible rows to select.")
  }
  return first.id
}

const SCENARIOS: Scenario[] = [
  {
    id: "triage-pending",
    title: "Triage pending orders",
    prompt:
      "Show me pending orders, highest value first, and open the biggest one.",
    steps: [
      {
        tool: "select_choose",
        args: { target: "status-filter", value: "pending" },
        note: "Filter the table down to pending orders.",
      },
      {
        tool: "table_sort",
        args: { target: "orders", column: "total", direction: "desc" },
        note: "Put the highest-value orders first.",
      },
      {
        tool: "table_select_rows",
        args: (read) => ({
          target: "orders",
          rowIds: [firstRowId(read("orders"))],
        }),
        note: "Select the top row, read from live table state.",
      },
      {
        tool: "dialog_open",
        args: { target: "order-dialog" },
        note: "Open the selected order in the detail dialog.",
      },
    ],
  },
  {
    id: "expedite-shipment",
    title: "Expedite a shipment",
    prompt:
      "Open the first order, switch to Shipping, and turn on expedited delivery.",
    steps: [
      {
        tool: "table_select_rows",
        args: (read) => ({
          target: "orders",
          rowIds: [firstRowId(read("orders"))],
        }),
        note: "Select the first order, read from live table state.",
      },
      {
        tool: "dialog_open",
        args: { target: "order-dialog" },
        note: "Open its detail dialog.",
      },
      {
        tool: "tabs_select",
        args: { target: "order-tabs", value: "shipping" },
        note: "Switch to Shipping — the tabs exist only while the dialog is open.",
      },
      {
        tool: "checkbox_set",
        args: { target: "expedited", checked: true },
        note: "Turn on expedited delivery.",
      },
    ],
  },
  {
    id: "reset-workspace",
    title: "Reset the workspace",
    prompt: "Clear the filters and close everything.",
    steps: [
      {
        tool: "action_refresh-orders",
        args: {},
        note: "Clear the search and status filters.",
      },
      {
        tool: "dialog_close",
        args: { target: "order-dialog" },
        note: "Close the order dialog.",
      },
    ],
  },
]

const COLUMNS: DataTableColumn<Order>[] = [
  { id: "id", header: "ID", accessor: (o) => o.id },
  { id: "customer", header: "Customer", accessor: (o) => o.customer },
  { id: "status", header: "Status", accessor: (o) => o.status },
  {
    id: "total",
    header: "Total",
    accessor: (o) => o.total,
    cell: (o) => `$${o.total.toFixed(2)}`,
  },
  { id: "placedAt", header: "Placed", accessor: (o) => o.placedAt },
  { id: "channel", header: "Channel", accessor: (o) => o.channel },
  {
    id: "internalNote",
    header: "Internal Note",
    accessor: (o) => o.internalNote,
    agentHidden: true,
  },
]

const SECTION_HEADING =
  "font-mono text-xs uppercase tracking-wider text-muted-foreground"

export default function Demo(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null)
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const filteredOrders = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return ORDERS.filter((order) => {
      if (query && !order.customer.toLowerCase().includes(query)) {
        return false
      }
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [searchQuery, statusFilter])

  const activeOrder = React.useMemo<Order | null>(() => {
    const id = activeOrderId ?? selectedRowIds[0] ?? null
    if (!id) return null
    return ORDERS.find((o) => o.id === id) ?? null
  }, [activeOrderId, selectedRowIds])

  return (
    <div className="space-y-8 py-8">
      <PageHeader
        title="Demo"
        description="An ordinary shadcn admin screen made agent-operable. Watch recorded scenarios drive it, or explore it by hand with the tool runner."
        eyebrow="Scenarios"
      />

      {/* `min-w-0` on the content column: a `1fr` grid track will not shrink
          below its content's min-content width, so the orders table pushed the
          console column past the viewport edge. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Scenario runner: recorded tool calls against the live registry */}
          <ScenarioRunner scenarios={SCENARIOS} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              placeholder="Search by customer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              agent={{ id: "order-search", label: "Search orders" }}
              className="w-64"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              agent={{ id: "status-filter", label: "Status filter" }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <AgentAction
              id="refresh-orders"
              description="Refresh the orders list and clear all filters."
              execute={() => {
                setSearchQuery("")
                setStatusFilter("all")
                return { refreshed: true, orderCount: ORDERS.length }
              }}
            >
              <Button variant="outline">Refresh</Button>
            </AgentAction>
          </div>

          {/* Orders table */}
          <DataTable
            data={filteredOrders}
            columns={COLUMNS}
            getRowId={(o) => o.id}
            onRowActivate={(order) => {
              setActiveOrderId(order.id)
              setDialogOpen(true)
            }}
            onRowSelectionChange={(ids) => setSelectedRowIds(ids)}
            agent={{ id: "orders", label: "Orders" }}
          />
        </div>

        {/* Side panel: tool runner */}
        <aside className="space-y-4">
          <h2 className={SECTION_HEADING}>Tool runner</h2>
          <ToolRunner />
        </aside>
      </div>

      {/* Order detail dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={{ id: "order-dialog", label: "Order detail" }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {activeOrder ? `Order ${activeOrder.id}` : "Order detail"}
            </DialogTitle>
            <DialogDescription>
              {activeOrder
                ? activeOrder.customer
                : "No order selected."}
            </DialogDescription>
          </DialogHeader>

          {activeOrder ? (
            <Tabs
              defaultValue="summary"
              agent={{ id: "order-tabs", label: "Order detail tabs" }}
            >
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="shipping">Shipping</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-2 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-mono">{activeOrder.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono">
                    ${activeOrder.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Placed</span>
                  <span className="font-mono">{activeOrder.placedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Channel</span>
                  <span className="font-mono">{activeOrder.channel}</span>
                </div>
              </TabsContent>

              <TabsContent value="shipping" className="space-y-4 pt-4 text-sm">
                <p className="text-muted-foreground">
                  Shipping method and delivery options.
                </p>
                <Label className="flex items-center gap-3">
                  <Checkbox
                    defaultChecked={false}
                    agent={{ id: "expedited", label: "Expedited delivery" }}
                  />
                  Expedited delivery
                </Label>
              </TabsContent>

              <TabsContent value="notes" className="space-y-2 pt-4 text-sm">
                <p className="text-muted-foreground">
                  Internal note — not exposed to the agent.
                </p>
                <p className="rounded bg-muted/40 p-3 font-mono text-[13px]">
                  {activeOrder.internalNote}
                </p>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a row to see order details.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
