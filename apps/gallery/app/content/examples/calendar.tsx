/**
 * calendar example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import * as React from "react"

import { Calendar } from "@/components/radix/ui/calendar"

export function Preview(): React.JSX.Element {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 12))
  return (
    <div className="space-y-3">
      <Calendar
        mode="single"
        defaultMonth={date}
        selected={date}
        onSelect={setDate}
        agent={{ id: "preview-calendar", label: "Preview calendar" }}
      />
    </div>
  )
}

export const usage = `const [date, setDate] = React.useState<Date>()

<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  agent={{ id: "booking-date", label: "Booking date" }}
/>

// Range mode holds exactly two dates, start then end:
// <Calendar mode="range" selected={range} onSelect={setRange} />`
