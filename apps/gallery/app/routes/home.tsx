import type { Route } from "./+types/home"
import { CodeBlock } from "@/components/site/code-block"
import { Prose } from "@/components/site/prose"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Agent UI" }]
}

const PIPELINE = [
  { label: "React Component", owns: "Owns component state." },
  { label: "Capability", owns: "Owns semantic interaction." },
  { label: "Capability Registry", owns: "Owns live identity and dispatch." },
  { label: "Protocol Adapter", owns: "Owns protocol exposure." },
  { label: "WebMCP", owns: "Owns the agent-facing tool surface." },
] as const

const COMMANDS = [
  {
    name: "Add",
    command: "npx agent-ui add data-table",
    description:
      "Installs an agent-native component with built-in capability bindings.",
  },
  {
    name: "Migrate",
    command: "npx agent-ui migrate",
    description:
      "Upgrades supported shadcn components in place via codemods.",
  },
  {
    name: "Inspect",
    command: "npx agent-ui doctor",
    description: "Inspects integration status without repairing anything.",
  },
] as const

export default function Home() {
  return (
    <div className="space-y-16 py-8">
      <section className="space-y-6">
        <h1 className="font-mono text-3xl font-medium tracking-tight">agent-ui</h1>
        <p className="text-lg text-foreground">
          React components that ship with native agent semantics.
        </p>
        <CodeBlock code="npx agent-ui migrate" lang="bash" />
        <Prose>
          <p className="text-muted-foreground">
            Run it on an existing shadcn site and supported components become
            agent-operable with no application-level WebMCP code.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Pipeline
        </h2>
        <ol className="list-none border-l border-border">
          {PIPELINE.map((stage) => (
            <li key={stage.label} className="py-3 pl-4">
              <p className="font-mono text-sm font-medium">{stage.label}</p>
              <p className="text-xs text-muted-foreground">{stage.owns}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Commands
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {COMMANDS.map((cmd) => (
            <div
              key={cmd.name}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <p className="font-mono text-sm font-medium">{cmd.name}</p>
              <CodeBlock code={cmd.command} lang="bash" />
              <p className="text-xs text-muted-foreground">{cmd.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-sm font-medium text-foreground">
          One interface. Two users: humans and agents.
        </p>
      </section>
    </div>
  )
}
