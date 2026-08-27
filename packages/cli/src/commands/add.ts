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
import { blank, info, step, title } from "../ui/log.js"
import { reportDependencies, reportFiles } from "./init.js"

export interface AddOptions {
  cwd?: string
  dryRun?: boolean
  registry?: string
}

/** One line describing what an installed component gives an agent. */
function capabilitySummary(agentUi: AgentUiMeta | undefined): string {
  if (!agentUi) return "runtime"
  switch (agentUi.status) {
    case "agent-native":
      return `kind ${agentUi.kind} · ${agentUi.actions.join(", ")}`
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
  const { cwd = process.cwd(), dryRun = false, registry } = options

  const config = await loadProject(cwd)
  const client = createRegistryClient(registry ?? defaultRegistrySource())
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
  const result = await installItems(config, items, { dryRun })

  title(dryRun ? "Agent UI add (dry run)" : "Agent UI add")
  blank()
  reportFiles(result.files)
  reportDependencies(result.installedDependencies)

  blank()
  info("Agent capabilities")
  const byName = new Map<string, RegistryItem>(items.map((item) => [item.name, item]))
  for (const name of components) {
    const item = byName.get(name)
    step(`${name.padEnd(14)}${capabilitySummary(item?.agentUi)}`)
  }
}
