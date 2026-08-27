/**
 * Agent UI — `agent-ui init` command.
 *
 * Installs the Agent UI infrastructure and leaves application behaviour
 * unchanged. Running it twice is safe: that property comes from `installItems`
 * comparing bytes, not from an "already initialised" branch.
 */

import { relative } from "node:path"

import { loadProject, type ProjectConfig } from "../project/config.js"
import { createRegistryClient, defaultRegistrySource } from "../registry/client.js"
import { installItems, type WrittenFile } from "../registry/install.js"
import { blank, info, step, success, title } from "../ui/log.js"

export interface InitOptions {
  cwd?: string
  dryRun?: boolean
  registry?: string
}

/** `✓ created  lib/agent-ui/registry.ts` and friends. */
export function reportFiles(files: WrittenFile[]): void {
  for (const file of files) {
    if (file.status === "unchanged") {
      step(`unchanged  ${file.target}`)
    } else {
      success(`✓ ${file.status.padEnd(9)}${file.target}`)
    }
  }
}

export function reportDependencies(installed: string[]): void {
  if (installed.length === 0) return
  blank()
  info(`Installed dependencies: ${installed.join(", ")}`)
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const { cwd = process.cwd(), dryRun = false, registry } = options

  const config = await loadProject(cwd)
  const client = createRegistryClient(registry ?? defaultRegistrySource())
  const items = await client.resolve(["agent-ui-runtime", "utils"])
  const result = await installItems(config, items, { dryRun })

  title(dryRun ? "Agent UI init (dry run)" : "Agent UI init")
  blank()
  reportFiles(result.files)
  reportDependencies(result.installedDependencies)

  blank()
  info(runtimeHint(config))
}

function runtimeHint(config: ProjectConfig): string {
  const where = relative(config.cwd, config.resolved.lib) || "."
  return [
    `Runtime installed in ${where}.`,
    "Nothing to mount or wire: a component with an `agent` prop registers itself and connects the adapter on mount.",
    "Without a WebMCP-capable browser the components stay ordinary React.",
  ].join("\n")
}
