import * as React from "react"

import type { Route } from "./+types/demo"
import { PageHeader } from "@/components/site/page-header"
import { ToolRunner } from "@/components/site/tool-runner"
import { AgentAction } from "@/lib/agent-ui/agent-action"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ORDERS, type Order, type OrderStatus } from "@/data/orders"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Demo — Agent UI" }]
}

type StatusFilter = "all" | OrderStatus

const CHALLENGE_PROMPT =
  "Show pending orders over $500, newest first. Open the first order, switch to Shipping, and enable expedited delivery."

const CHALLENGE_ACTIONS = [
  "table_filter",
  "table_sort",
  "table_select_rows",
  "dialog_open",
  "tabs_select",
  "checkbox_set",
] as const

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
        description="An ordinary shadcn admin screen made agent-operable. Drive it by hand or with the tool runner."
        eyebrow="Challenge"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Challenge prompt */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-mono text-[11px] text-muted-foreground">
              Challenge prompt
            </p>
            <blockquote className="text-sm leading-relaxed">
              {CHALLENGE_PROMPT}
            </blockquote>
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] text-muted-foreground">
                Structured actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHALLENGE_ACTIONS.map((action) => (
                  <code
                    key={action}
                    className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {action}
                  </code>
                ))}
              </div>
            </div>
          </div>

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
