/**
 * command example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/radix/ui/command"

export function Preview(): React.JSX.Element {
  return (
    <Command className="rounded-lg border md:w-96">
      <CommandInput
        placeholder="Search reports…"
        agent={{ id: "preview-command-input", label: "Preview command search" }}
      />
      <CommandList>
        <CommandEmpty>No reports found.</CommandEmpty>
        <CommandGroup heading="Reports">
          <CommandItem>Quarterly report.pdf</CommandItem>
          <CommandItem>Annual summary.pdf</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export const usage = `// The search input is agent-operable; items run the application's own
// onSelect and are deliberately not agent actions.
<Command>
  <CommandInput
    placeholder="Search reports…"
    agent={{ id: "report-search", label: "Report search" }}
  />
  <CommandList>
    <CommandEmpty>No reports found.</CommandEmpty>
    <CommandGroup heading="Reports">
      <CommandItem onSelect={(value) => openReport(value)}>
        Quarterly report.pdf
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`
