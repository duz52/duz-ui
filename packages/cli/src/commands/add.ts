/**
 * Agent UI — `agent-ui add` command.
 *
 * Installs agent-native components. They already carry their capability
 * bindings, so no codemod is involved. `registryDependencies` pull in the
 * runtime and any component the requested one imports.
 */

import { loadProject } from "../project/config.js"
import { createRegistryClient, defaultRegistrySource } from "../registry/client.js"
import { installItems } from "../registry/install.js"
import type { AgentUiMeta, RegistryItem } from "../registry/schema.js"
import { blank, info, step, title, warn } from "../ui/log.js"
import { reportDependencies, reportFiles } from "./init.js"

export interface AddOptions {
  cwd?: string
  dryRun?: boolean
  registry?: string
  overwrite?: boolean
}

/** One line describing what an installed component gives an agent. */
function capabilitySummary(agentUi: AgentUiMeta | undefined): string {
  if (!agentUi) return "runtime"
  switch (agentUi.status) {
    case "agent-native":
      return agentUi.capabilities
        .map((c) =>
          // A read-only kind has no actions, and a dangling separator would
          // read as a truncated line rather than a deliberate absence.
          c.actions.length > 0
            ? `kind ${c.kind} · ${c.actions.join(", ")}`
            : `kind ${c.kind} · read only`,
        )
        .join(" / ")
    case "presentation":
      return "presentation only, no agent capabilities"
    case "explicit-semantics":
      return "requires explicit semantics (AgentAction)"
  }
}

export async function addCommand(
  components: string[],
  options: AddOptions = {},
): Promise<void> {
  const { cwd = process.cwd(), dryRun = false, registry, overwrite = false } =
    options

  const config = await loadProject(cwd)
  const client = createRegistryClient(registry ?? defaultRegistrySource(), config.base)
  const index = await client.index()
  const available = index.items
    .filter((item) => item.type === "registry:ui")
    .map((item) => item.name)

  if (components.length === 0) {
    throw new Error(`Name at least one component. Available: ${available.join(", ")}.`)
  }

  const unknown = components.filter((name) => !available.includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `Unknown component${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. ` +
        `Available: ${available.join(", ")}.`,
    )
  }

  const items = await client.resolve(components)
  const result = await installItems(config, items, { dryRun, overwrite })

  const refused = result.files.filter((f) => f.status === "refused")
  const reported = result.files.filter((f) => f.status !== "refused")

  title(dryRun ? "Agent UI add (dry run)" : "Agent UI add")
  blank()
  reportFiles(reported)
  reportDependencies(result.installedDependencies)

  if (refused.length > 0) {
    blank()
    info("Project-owned files left untouched:")
    for (const file of refused) {
      warn(`  ${file.target}`)
    }
    blank()
    warn("Run with --overwrite to replace them.")
    process.exitCode = 1
    return
  }

  blank()
  info("Agent capabilities")
  const byName = new Map<string, RegistryItem>(items.map((item) => [item.name, item]))
  // Derived, not a constant: a name longer than the column ran into the
  // summary it is supposed to introduce.
  const width = Math.max(...components.map((name) => name.length)) + 2
  for (const name of components) {
    const item = byName.get(name)
    step(`${name.padEnd(width)}${capabilitySummary(item?.agentUi)}`)
  }
}
