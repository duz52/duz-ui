import * as React from "react"

import type { Route } from "./+types/playground"
import { PageHeader } from "@/components/site/page-header"
import { ToolRunner } from "@/components/site/tool-runner"
import { useCapabilities } from "@/lib/agent-ui/use-capabilities"
import { getCapabilityRegistry } from "@/lib/agent-ui/registry"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Playground — Agent UI" }]
}

const SECTION_HEADING =
  "font-mono text-xs uppercase tracking-wider text-muted-foreground"

function CapabilitiesTable(): React.JSX.Element {
  const capabilities = useCapabilities()
  const registry = getCapabilityRegistry()
  const [readId, setReadId] = React.useState<string | null>(null)
  const [readResult, setReadResult] = React.useState<string | null>(null)
  const [readError, setReadError] = React.useState<string | null>(null)

  async function handleRead(id: string): Promise<void> {
    setReadId(id)
    setReadResult(null)
    setReadError(null)
    try {
      // registry.read throws CapabilityError("unknown_target", ...) if the
      // capability unmounted between render and click — the honest answer.
      const state = registry.read(id)
      setReadResult(JSON.stringify(state, null, 2))
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e))
    }
  }

  if (capabilities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No agent-operable elements are mounted. Navigate to a component page or
        the demo to mount capabilities.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-left font-medium">id</th>
              <th className="p-3 text-left font-medium">kind</th>
              <th className="p-3 text-left font-medium">label</th>
              <th className="p-3 text-left font-medium">actions</th>
              <th className="p-3 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr
                key={cap.id}
                className="border-b border-border last:border-0"
              >
                <td className="p-3 align-top font-mono text-[13px]">
                  {cap.id}
                </td>
                <td className="p-3 align-top font-mono text-[13px] text-muted-foreground">
                  {cap.kind}
                </td>
                <td className="p-3 align-top text-muted-foreground">
                  {cap.label ?? "—"}
                </td>
                <td className="p-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {cap.actions.map((action) => (
                      <code
                        key={action}
                        className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {action}
                      </code>
                    ))}
                  </div>
                </td>
                <td className="p-3 align-top">
                  <button
                    type="button"
                    onClick={() => void handleRead(cap.id)}
                    className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    read
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {readId && readResult ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted-foreground">
            state of {readId}
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">
            <code>{readResult}</code>
          </pre>
        </div>
      ) : null}

      {readId && readError ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted-foreground">
            error reading {readId}
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed text-destructive">
            <code>{readError}</code>
          </pre>
        </div>
      ) : null}
    </div>
  )
}

export default function Playground(): React.JSX.Element {
  return (
    <div className="space-y-10 py-8">
      <PageHeader
        title="Playground"
        description="Inspect live capabilities and run agent tools against the page."
      />

      <section className="space-y-4">
        <h2 className={SECTION_HEADING}>Live capabilities</h2>
        <CapabilitiesTable />
      </section>

      <section className="space-y-4">
        <h2 className={SECTION_HEADING}>Tool runner</h2>
        <ToolRunner />
      </section>
    </div>
  )
}
