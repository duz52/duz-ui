"use client"

/**
 * Duz UI — DataTable.
 *
 * Wraps `@tanstack/react-table` v8 and exposes a `data-table` capability whose
 * actions are the intrinsic semantics of a data table: filter, sort, select
 * rows, paginate and toggle column visibility. React (via TanStack) remains the
 * canonical state owner; the capability reads back from the table instance
 * after every transition.
 */

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { CapabilityState } from "@/lib/duz-ui/capability"
import { useCapability, type AgentProp } from "@/lib/duz-ui/use-capability"
import {
  expectBoolean,
  expectInteger,
  expectOneOf,
  expectString,
  expectStringArray,
  rejectState,
} from "@/lib/duz-ui/validate"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type CellValue = string | number | boolean | null

export interface DataTableColumn<Row> {
  /** Stable column id. Also the agent-visible column name. */
  id: string
  /** Human label rendered in the header and shown to the agent. */
  header: string
  /** Reads the raw cell value used for filtering and sorting. */
  accessor: (row: Row) => CellValue
  /** Optional custom cell renderer. Defaults to rendering the accessor value. */
  cell?: (row: Row) => React.ReactNode
  enableSorting?: boolean
  enableFiltering?: boolean
  /**
   * Keeps the column out of everything the agent can read or filter, even
   * while it is visible. Use for values that are rendered but not semantic.
   */
  agentHidden?: boolean
}

export interface DataTableProps<Row> {
  data: Row[]
  columns: DataTableColumn<Row>[]
  /** Stable row identity. Required: agents select rows by id, never by index. */
  getRowId: (row: Row) => string
  agent?: AgentProp
  pageSize?: number
  enableRowSelection?: boolean
  className?: string
  onRowSelectionChange?: (selectedIds: string[]) => void
  onRowActivate?: (row: Row) => void
  emptyMessage?: string
}

// ---------------------------------------------------------------------------
// Capability contract
// ---------------------------------------------------------------------------

type DataTableState = CapabilityState & {
  columns: { id: string; label: string; sortable: boolean; filterable: boolean }[]
  hiddenColumns: string[]
  rowCount: number
  totalRowCount: number
  page: number
  pageCount: number
  pageSize: number
  sort: { column: string; direction: "asc" | "desc" }[]
  filters: { column: string; value: string }[]
  selectedRowIds: string[]
  rows: { id: string; cells: Record<string, CellValue> }[]
}

type DataTableActions = {
  filter: { column: string; value: string }
  sort: { column: string; direction: "asc" | "desc" }
  select_rows: { rowIds: string[] }
  select_all_rows: { selected: boolean }
  set_page: { page: number }
  set_column_visibility: { column: string; visible: boolean }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Columns the agent may read, filter or sort: not `agentHidden`, and currently
 * visible. Filtering on a hidden column would be an oracle over values the
 * agent is not allowed to read, so visibility gates every semantic operation.
 */
function agentColumns<Row>(
  columns: DataTableColumn<Row>[],
  visibility: VisibilityState,
): DataTableColumn<Row>[] {
  return columns.filter((c) => !c.agentHidden && (visibility[c.id] ?? true))
}

/**
 * Columns `set_column_visibility` may act on. Visibility is deliberately not
 * considered here: showing a hidden column again is the whole point of that
 * action. `agentHidden` still applies.
 */
function agentToggleableColumns<Row>(
  columns: DataTableColumn<Row>[],
): DataTableColumn<Row>[] {
  return columns.filter((c) => !c.agentHidden)
}

/** Shared filter predicate used by both the column filterFn and the detail computation. */
function cellMatchesFilter(value: CellValue, filterValue: string): boolean {
  if (value === null) return false
  return String(value).toLowerCase().includes(filterValue.toLowerCase())
}

function renderCellValue(value: CellValue): string {
  if (value === null) return ""
  return String(value)
}

function sortIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <ChevronUp className="size-3.5" />
  if (sorted === "desc") return <ChevronDown className="size-3.5" />
  return <ChevronsUpDown className="size-3.5" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<Row>(props: DataTableProps<Row>): React.JSX.Element {
  const enableRowSelection = props.enableRowSelection ?? true
  const pageSize = props.pageSize ?? 10

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = props.columns.map((col) => ({
      id: col.id,
      accessorFn: (row: Row) => col.accessor(row),
      header: col.header,
      cell: (context) => {
        if (col.cell) return col.cell(context.row.original)
        return renderCellValue(context.getValue<CellValue>())
      },
      enableSorting: col.enableSorting ?? true,
      enableColumnFilter: col.enableFiltering ?? true,
      filterFn: (row, columnId, filterValue) =>
        cellMatchesFilter(
          row.getValue<CellValue>(columnId),
          String(filterValue),
        ),
      enableHiding: true,
    }))

    if (enableRowSelection) {
      cols.unshift({
        id: "select",
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        // `agent={false}` on both: the table's selection is already a
        // semantic action (`select_rows`, which addresses rows by id). Left to
        // register themselves, these controls would add one anonymous
        // capability per visible row — `checkbox__r_7_`, all labelled "Select
        // row" — burying the page's real elements in noise an agent cannot
        // act on. A composite's internal controls belong to the composite's
        // capability, never to their own.
        header: ({ table: t }) => (
          <Checkbox
            agent={false}
            checked={t.getIsAllRowsSelected()}
            // Base UI factors indeterminate out of `checked` into its own
            // prop. `getIsSomeRowsSelected` is already false when every row
            // is selected, so this matches the Radix ternary exactly.
            indeterminate={t.getIsSomeRowsSelected()}
            onCheckedChange={(value) => t.toggleAllRowsSelected(value)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            agent={false}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
      })
    }

    return cols
  }, [props.columns, enableRowSelection])

  const table = useReactTable<Row>({
    data: props.data,
    columns,
    state: { sorting, columnFilters, pagination, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater)
      const resolved =
        typeof updater === "function" ? updater(rowSelection) : updater
      props.onRowSelectionChange?.(
        Object.entries(resolved)
          .filter(([, v]) => v)
          .map(([k]) => k),
      )
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => props.getRowId(row),
    enableRowSelection,
    autoResetPageIndex: false,
  })

  // -- Capability ----------------------------------------------------------

  const read = (): DataTableState => {
    const state = table.getState()
    const toggleable = agentToggleableColumns(props.columns)
    const visibleAgentCols = agentColumns(props.columns, state.columnVisibility)

    const columnsOut = visibleAgentCols.map((col) => ({
      id: col.id,
      label: col.header,
      sortable: col.enableSorting ?? true,
      filterable: col.enableFiltering ?? true,
    }))

    const hiddenColumns = toggleable
      .filter((c) => !(state.columnVisibility[c.id] ?? true))
      .map((c) => c.id)

    const sort = state.sorting.map((s) => ({
      column: s.id,
      direction: (s.desc ? "desc" : "asc") as "asc" | "desc",
    }))

    const filters = state.columnFilters
      .filter((f) => visibleAgentCols.some((c) => c.id === f.id))
      .map((f) => ({ column: f.id, value: String(f.value) }))

    const selectedRowIds = Object.entries(state.rowSelection)
      .filter(([, selected]) => selected)
      .map(([id]) => id)

    // Every row of the filtered and sorted model, in that model's order:
    // pagination is how the page shows rows to a person, not a property of
    // the data, so a read is not bounded by it. The tools layer, not this
    // component, windows the result to the output budget. Long cell text is
    // still cut to a preview.
    const rows = table.getSortedRowModel().rows.map((row) => {
      const cells: Record<string, CellValue> = {}
      for (const col of visibleAgentCols) {
        const value = col.accessor(row.original)
        if (typeof value === "string" && value.length > 120) {
          cells[col.id] = value.slice(0, 120) + "\u2026"
        } else {
          cells[col.id] = value
        }
      }
      return { id: row.id, cells }
    })

    return {
      columns: columnsOut,
      hiddenColumns,
      rowCount: table.getFilteredRowModel().rows.length,
      totalRowCount: props.data.length,
      page: state.pagination.pageIndex + 1,
      pageCount: table.getPageCount(),
      pageSize: state.pagination.pageSize,
      sort,
      filters,
      selectedRowIds,
      rows,
    }
  }

  const actions = {
    filter: (input: { column: string; value: string }) => {
      const column = expectString(input, "column")
      const value = expectString(input, "value")

      const operable = agentColumns(props.columns, table.getState().columnVisibility)
      const col = operable.find((c) => c.id === column)
      if (!col || (col.enableFiltering ?? true) === false) {
        const filterable = operable
          .filter((c) => c.enableFiltering ?? true)
          .map((c) => c.id)
          .join(", ")
        rejectState(
          `Column "${column}" is not filterable. Filterable columns: ${filterable}.`,
        )
      }

      const nextFilters =
        value === ""
          ? columnFilters.filter((f) => f.id !== column)
          : [
              ...columnFilters.filter((f) => f.id !== column),
              { id: column, value },
            ]

      table.setColumnFilters(nextFilters)
      table.setPageIndex(0)
      // The resulting row count is `rowCount` in the post-commit state. Working
      // it out here would be a second implementation of the table's own
      // filtering, and the two could disagree.
    },
    sort: (input: { column: string; direction: "asc" | "desc" }) => {
      const column = expectString(input, "column")
      const direction = expectOneOf(
        expectString(input, "direction"),
        ["asc", "desc"] as const,
        "direction",
      )

      const operable = agentColumns(props.columns, table.getState().columnVisibility)
      const col = operable.find((c) => c.id === column)
      if (!col || (col.enableSorting ?? true) === false) {
        const sortable = operable
          .filter((c) => c.enableSorting ?? true)
          .map((c) => c.id)
          .join(", ")
        rejectState(
          `Column "${column}" is not sortable. Sortable columns: ${sortable}.`,
        )
      }

      table.setSorting([{ id: column, desc: direction === "desc" }])
    },
    select_rows: (input: { rowIds: string[] }) => {
      const rowIds = expectStringArray(input, "rowIds")

      if (!enableRowSelection) {
        rejectState("Row selection is disabled for this table.")
      }

      const filteredRowIds = new Set(
        table.getFilteredRowModel().rows.map((r) => r.id),
      )
      const invalid = rowIds.filter((id) => !filteredRowIds.has(id))
      if (invalid.length > 0) {
        rejectState(
          `Some requested row ids are not present in the filtered row set. ${filteredRowIds.size} row(s) are available.`,
        )
      }

      const next: RowSelectionState = {}
      for (const id of rowIds) next[id] = true
      table.setRowSelection(next)
    },
    select_all_rows: (input: { selected: boolean }) => {
      const selected = expectBoolean(input, "selected")

      if (!enableRowSelection) {
        rejectState("Row selection is disabled for this table.")
      }

      // The header checkbox's own handler. Selecting every row by id would
      // cost the agent a read of all of them and an input that grows with the
      // table; this is the gesture a person makes, so it is the gesture the
      // agent makes, and the resulting state is the same one either way.
      table.toggleAllRowsSelected(selected)
    },
    set_page: (input: { page: number }) => {
      const page = expectInteger(input, "page", 1)
      const pageCount = table.getPageCount()
      if (page > pageCount) {
        rejectState(`Page ${page} exceeds the page count of ${pageCount}.`)
      }
      table.setPageIndex(page - 1)
    },
    set_column_visibility: (input: { column: string; visible: boolean }) => {
      const column = expectString(input, "column")
      const visible = expectBoolean(input, "visible")

      const toggleable = agentToggleableColumns(props.columns)
      if (column === "select" || !toggleable.some((c) => c.id === column)) {
        const allowed = toggleable.map((c) => c.id).join(", ")
        rejectState(
          `Column "${column}" is not agent-operable. Allowed columns: ${allowed}.`,
        )
      }

      table.setColumnVisibility((prev) => ({ ...prev, [column]: visible }))
    },
  }

  useCapability<DataTableState, DataTableActions>({
    agent: props.agent,
    kind: "data-table",
    defaultLabel: "Table",
    read,
    actions,
  })

  // -- Render --------------------------------------------------------------

  const selectedCount = table.getSelectedRowModel().rows.length
  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <div className={cn("space-y-4", props.className)}>
      <div className="rounded-md border">
        <Table agent={false} aria-rowcount={filteredCount}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : header.column.getCanSort()
                        ? (
                            <Button
                              agent={false}
                              variant="ghost"
                              size="sm"
                              onClick={
                                header.column.getToggleSortingHandler() ??
                                undefined
                              }
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {sortIcon(header.column.getIsSorted())}
                            </Button>
                          )
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0
              ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {props.emptyMessage ?? "No results."}
                    </TableCell>
                  </TableRow>
                )
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={() => props.onRowActivate?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {selectedCount} of {filteredCount} row(s) selected
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              agent={false}
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              agent={false}
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
