import * as React from "react"
import { useParams } from "react-router"

import type { Route } from "./+types/component"
import { getItem, type GalleryItem } from "@/registry"
import type { Example } from "@/content/examples"
import { EXAMPLES as BASE_EXAMPLES } from "@/content/examples.base.generated"
import { EXAMPLES as RADIX_EXAMPLES } from "@/content/examples.radix.generated"
import { EXAMPLE_OVERRIDES as BASE_OVERRIDES } from "@/content/examples-overrides/base"
import { EXAMPLE_OVERRIDES as RADIX_OVERRIDES } from "@/content/examples-overrides/radix"
import { KindBadge } from "@/components/site/kind-badge"
import { CodeBlock } from "@/components/site/code-block"
import { ToolRunner } from "@/components/site/tool-runner"
import { BaseSwitcher } from "@/components/site/base-switcher"
import { createAgentTools, type AgentTool } from "@/lib/agent-ui/tools"
import { getCapabilityRegistry } from "@/lib/agent-ui/registry"

export function meta({ params }: Route.MetaArgs) {
  const item = getItem(params.base ?? "", params.name ?? "")
  return [{ title: item ? `${item.title} — Agent UI` : "Agent UI" }]
}

export function loader({ params }: Route.LoaderArgs): { item: GalleryItem } {
  const item = getItem(params.base ?? "", params.name ?? "")
  if (!item) {
    throw new Response("Not Found", { status: 404 })
  }
  return { item }
}

// ---------------------------------------------------------------------------
// Examples — the generated shared map merged with each base's hand-written
// overrides, selected by the base in the URL. The override wins: its keys
// are absent from the shared source precisely because the bases' grammars
// differ there.
// ---------------------------------------------------------------------------

const EXAMPLES: Record<string, Record<string, Example>> = {
  base: { ...BASE_EXAMPLES, ...BASE_OVERRIDES },
  radix: { ...RADIX_EXAMPLES, ...RADIX_OVERRIDES },
}

// ---------------------------------------------------------------------------
// Agent Capabilities — client-side, reads live tool definitions
// ---------------------------------------------------------------------------

function describeType(def: unknown): string {
  if (typeof def !== "object" || def === null) return "unknown"
  const d = def as Record<string, unknown>
  if (Array.isArray(d.enum)) {
    return d.enum.map((v) => `"${String(v)}"`).join(" | ")
  }
  if (d.type === "array") return "string[]"
  return String(d.type ?? "unknown")
}

function describeProp(def: unknown): string | undefined {
  if (typeof def !== "object" || def === null) return undefined
  const d = def as Record<string, unknown>
  return typeof d.description === "string" ? d.description : undefined
}

function ArgumentList({ tool }: { tool: AgentTool }): React.JSX.Element {
  const entries = Object.entries(tool.inputSchema.properties).filter(
    ([key]) => key !== "target",
  )
  if (entries.length === 0) {
    return <span className="text-muted-foreground">No arguments.</span>
  }
  return (
    <ul className="space-y-1.5">
      {entries.map(([key, def]) => (
        <li key={key} className="space-y-0.5">
          <div className="flex items-baseline gap-2">
            <code className="font-mono text-[13px]">{key}</code>
            <span className="font-mono text-[11px] text-muted-foreground">
              {describeType(def)}
            </span>
          </div>
          {describeProp(def) ? (
            <p className="text-xs text-muted-foreground">{describeProp(def)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function AgentCapabilities({
  agentUi,
}: {
  agentUi: GalleryItem["agentUi"]
}): React.JSX.Element {
  const registry = getCapabilityRegistry()
  const [tools, setTools] = React.useState<AgentTool[]>([])

  React.useEffect(() => {
    const refresh = () => setTools(createAgentTools(registry))
    refresh()
    return registry.subscribe(refresh)
  }, [registry])

  if (!agentUi) {
    return (
      <p className="text-sm text-muted-foreground">
        This item does not expose agent capabilities.
      </p>
    )
  }

  if (agentUi.status === "presentation") {
    return (
      <p className="text-sm text-muted-foreground">
        Presentation-only component — no semantic capability.
      </p>
    )
  }

  if (agentUi.status === "explicit-semantics") {
    return (
      <p className="text-sm text-muted-foreground">
        Requires explicit business semantics. A button cannot know what its{" "}
        <code className="font-mono">onClick</code> means, so it never becomes
        an automatic agent action. Wrap it in{" "}
        <code className="font-mono">AgentAction</code> to expose a business
        action.
      </p>
    )
  }

  const capabilityTools = agentUi.capabilities.map((cap) => ({
    cap,
    tools: cap.actions.map((action) => ({
      action,
      tool: tools.find((t) => t.name.endsWith(`_${action}`)),
    })),
  }))

  return (
    <div className="space-y-6">
      {capabilityTools.map(({ cap, tools: capTools }, index) => (
        <div key={index} className="space-y-3">
          <KindBadge kind={cap.kind} />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left font-medium">Action</th>
                  <th className="p-3 text-left font-medium">Arguments</th>
                </tr>
              </thead>
              <tbody>
                {capTools.map(({ action, tool }) => (
                  <tr
                    key={action}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3 align-top font-mono text-[13px]">
                      {action}
                    </td>
                    <td className="p-3">
                      {tool ? (
                        <ArgumentList tool={tool} />
                      ) : (
                        <span className="text-muted-foreground">
                          Mount the preview to see arguments.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SECTION_HEADING =
  "font-mono text-xs uppercase tracking-wider text-muted-foreground"

export default function Component({
  loaderData,
}: Route.ComponentProps): React.JSX.Element {
  const { item } = loaderData
  const { base } = useParams()
  const example = EXAMPLES[base ?? ""]?.[item.name]
  const Preview = example?.Preview

  return (
    <div className="space-y-12 py-8">
      <BaseSwitcher name={item.name} base={base ?? ""} />

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Live Preview</h2>
        {Preview ? (
          <div className="rounded-lg border border-border p-6">
            <Preview />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No preview available for this item.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Agent Capabilities</h2>
        <AgentCapabilities agentUi={item.agentUi} />
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Install</h2>
        <CodeBlock code={`npx agent-ui add ${item.name}`} lang="bash" />
        {item.dependencies.length > 0 ? (
          <div className="space-y-1">
            <p className="font-mono text-[11px] text-muted-foreground">
              npm dependencies
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.dependencies.map((dep) => (
                <code
                  key={dep}
                  className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {dep}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        {item.registryDependencies.length > 0 ? (
          <div className="space-y-1">
            <p className="font-mono text-[11px] text-muted-foreground">
              registry dependencies
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.registryDependencies.map((dep) => (
                <code
                  key={dep}
                  className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {dep}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Usage</h2>
        {example ? (
          <CodeBlock code={example.usage} lang="tsx" />
        ) : (
          <p className="text-sm text-muted-foreground">
            No usage example available.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Live WebMCP Test</h2>
        <p className="text-sm text-muted-foreground">
          Tools are scoped to the preview mounted above.
        </p>
        <ToolRunner />
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Source</h2>
        <div className="space-y-2">
          {item.files.map((file) => (
            <details
              key={file.target}
              className="rounded-lg border border-border"
            >
              <summary className="cursor-pointer p-4 font-mono text-sm">
                {file.target}
              </summary>
              <div className="border-t border-border">
                <CodeBlock code={file.content} lang="tsx" />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
