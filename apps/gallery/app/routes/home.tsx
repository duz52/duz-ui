import type { Route } from "./+types/home"
import { AgentPage } from "@/lib/duz-ui/agent-page"
import { CodeBlock } from "@/components/site/code-block"
import { Prose } from "@/components/site/prose"

// The home page states its identity from the same two strings it renders, so
// what an agent is told the page is and what a person reads cannot drift. Every
// other route gets this from `PageHeader`; this one styles its heading itself.
const TITLE = "duz-ui"
const TAGLINE = "React components that ship with native agent semantics."

export function meta({}: Route.MetaArgs) {
  return [{ title: "Duz UI" }]
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
    command: "npx duz-ui add data-table",
    description:
      "Installs an agent-native component with built-in capability bindings.",
  },
  {
    name: "Migrate",
    command: "npx duz-ui migrate --overwrite",
    description:
      "Upgrades supported shadcn components in place via codemods. Without the flag, a source that has drifted from stock is named rather than rewritten.",
  },
  {
    name: "Inspect",
    command: "npx duz-ui doctor",
    description: "Inspects integration status without repairing anything.",
  },
] as const

export default function Home() {
  return (
    <div className="space-y-16 py-8">
      <section className="space-y-6">
        <AgentPage title={TITLE} description={TAGLINE} />
        <h1 className="font-mono text-3xl font-medium tracking-tight">{TITLE}</h1>
        <p className="text-lg text-foreground">{TAGLINE}</p>
        <CodeBlock code="npx duz-ui migrate --overwrite" lang="bash" />
        <Prose>
          <p className="text-muted-foreground">
            Run it on an existing shadcn site and supported components become
            agent-operable with no application-level WebMCP code.
          </p>
          <p className="text-muted-foreground">
            The flag is there because a component is replaced only when Duz UI
            recognises its source structurally. Anything that has drifted — a
            tweaked class, an earlier shadcn generation — is named and left
            alone without it, which on a real project is usually most of them.
            It still refuses a swap that would drop an export, and{" "}
            <code className="font-mono text-[0.9em]">--dry-run</code> prints the
            plan before anything is written.
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
              // `min-w-0`: a grid item's default `min-width: auto` is its
              // content's minimum, and `npx duz-ui migrate --overwrite` does
              // not break — so the track grew past the viewport and the whole
              // page scrolled sideways at 320px. The command scrolls inside
              // its own block, which is what CodeBlock is for.
              className="min-w-0 space-y-3 rounded-lg border border-border p-4"
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
