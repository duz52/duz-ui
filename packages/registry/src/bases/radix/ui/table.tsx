"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  AgentContainerProvider,
  useAgentItemPosition,
} from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { readText } from "@/lib/agent-ui/agent-content"

/** Cap for each table cell reported to an agent. */
const CELL_MAX_LENGTH = 200

/** Cap for the row name prefixed onto a row control's label. */
const ROW_LABEL_MAX_LENGTH = 80

/**
 * Containment is wired without scanning: the table contributes its capability
 * id once, the body hands each row its position in O(1) inside that row's own
 * render, and a row's name is read only when a descendant capability
 * registers or an agent reads the table. No render or interaction path does
 * work proportional to the number of rows; only an agent-invoked read does.
 */

/** How many rows a read reports before it becomes a window with rowsOmitted. */
const TABLE_MAX_ROWS = 50

type TableContentState = {
  columns: string[]
  rows: Record<string, string>[]
  rowCount: number
  rowsOmitted?: number
}

function Table({
  className,
  ref,
  agent,
  ...props
}: React.ComponentProps<"table"> & { agent?: AgentProp }) {
  const tableRef = React.useRef<HTMLTableElement>(null)
  const mergedRef = useMergedRef(ref, tableRef)

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect.
  const { id } = useCapability<TableContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: "Table",
    read: () => {
      const root = tableRef.current
      if (!root) return { columns: [], rows: [], rowCount: 0 }

      const columns = Array.from(root.querySelectorAll("thead th")).map((th) =>
        readText(th, CELL_MAX_LENGTH),
      )
      const rowElements = Array.from(root.querySelectorAll("tbody tr"))
      const rows = rowElements.slice(0, TABLE_MAX_ROWS).map((row) => {
        const cells: Record<string, string> = {}
        Array.from(row.querySelectorAll("td")).forEach((cell, index) => {
          const header = columns[index]
          cells[header || `col${index}`] = readText(cell, CELL_MAX_LENGTH)
        })
        return cells
      })

      return {
        columns,
        rows,
        rowCount: rowElements.length,
        ...(rowElements.length > TABLE_MAX_ROWS
          ? { rowsOmitted: rowElements.length - TABLE_MAX_ROWS }
          : {}),
      }
    },
    actions: {},
  })
  // Every capability rendered inside the table — a row checkbox, the header
  // select-all — belongs to it. When the table opted out, `id` is undefined
  // and the provider passes `ownerId: undefined`, so descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
      >
        <table
          ref={mergedRef}
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </AgentContainerProvider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  // One position counter per render pass: each TableRow rendered inside this
  // body claims its 1-based position during that pass, in document order. A
  // discarded render discards its counter with it, and a re-render of the
  // body renumbers from 1.
  const claimed = new Map<string, number>()
  const claimItemPosition = (identity: string): number => {
    const held = claimed.get(identity)
    if (held !== undefined) return held
    const position = claimed.size + 1
    claimed.set(identity, position)
    return position
  }
  return (
    <AgentContainerProvider claimItemPosition={claimItemPosition}>
      <tbody
        data-slot="table-body"
        className={cn("[&_tr:last-child]:border-0", className)}
        {...props}
      />
    </AgentContainerProvider>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ref, ...props }: React.ComponentProps<"tr">) {
  const rowRef = React.useRef<HTMLTableRowElement>(null)
  const mergedRef = useMergedRef(ref, rowRef)
  // Claims this row's 1-based position among the body's rows for this render
  // pass. A header row renders outside any body and claims nothing, so body
  // numbering starts at 1 no matter how many header rows precede it.
  const index = useAgentItemPosition()
  // Resolved when a descendant capability registers, never during render:
  // the row's text exists only in the mounted DOM. The first cell that has
  // text names the row — usually not the cell holding the row's checkbox.
  const itemLabel = React.useCallback(() => {
    for (const cell of rowRef.current?.querySelectorAll("td") ?? []) {
      const text = readText(cell, ROW_LABEL_MAX_LENGTH)
      if (text !== "") return `row ${index}: ${text}`
    }
    return `row ${index}`
  }, [index])
  const row = (
    <tr
      ref={mergedRef}
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
  // A row that claimed no position — a header row — names no position: its
  // descendants keep their plain labels and inherit only the table as owner.
  if (index === null) return row
  return (
    <AgentContainerProvider itemLabel={itemLabel}>{row}</AgentContainerProvider>
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
