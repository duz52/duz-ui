/**
 * Agent UI — `agent-ui doctor` command.
 *
 * Reports facts. It never repairs anything: repair belongs to `init`, `add` and
 * `migrate` (spec section 19). Detection is structural — a file exists, or an
 * import is present — never a heuristic over visible text.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

import { loadProject, type ProjectConfig } from "../project/config.js"
import { createRegistryClient, defaultRegistrySource } from "../registry/client.js"
import type { RegistryIndexItem } from "../registry/schema.js"
import { blank, info, step, success, title, warn } from "../ui/log.js"

export interface DoctorOptions {
  cwd?: string
  registry?: string
}

/** Files whose presence proves a runtime layer is installed. */
const RUNTIME_PARTS: { label: string; file: string }[] = [
  { label: "capability registry", file: "registry.ts" },
  { label: "WebMCP adapter", file: "webmcp.ts" },
  { label: "React binding", file: "use-capability.ts" },
]

function runtimePath(config: ProjectConfig, file: string): string {
  return join(config.resolved.lib, "agent-ui", file)
}

function componentPath(config: ProjectConfig, name: string): string {
  return join(config.resolved.ui, `${name}.${config.tsx ? "tsx" : "jsx"}`)
}

/**
 * A component is agent-native when its source imports the React binding. That
 * is the one mechanism a migrated or installed component always carries.
 */
function isAgentNative(file: string, config: ProjectConfig): boolean {
  if (!existsSync(file)) return false
  const source = readFileSync(file, "utf8")
  return source.includes(`${config.aliases.lib}/agent-ui/use-capability`)
}

function installedComponentNames(config: ProjectConfig): Set<string> {
  if (!existsSync(config.resolved.ui)) return new Set()
  return new Set(
    readdirSync(config.resolved.ui, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(tsx|jsx)$/.test(entry.name))
      .map((entry) => entry.name.replace(/\.(tsx|jsx)$/, "")),
  )
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const { cwd = process.cwd(), registry } = options
  const config = await loadProject(cwd)

  title("Agent UI")
  blank()

  info("Runtime")
  step(`primitive base: ${config.base}`)
  for (const part of RUNTIME_PARTS) {
    const file = runtimePath(config, part.file)
    const shown = relative(config.cwd, file)
    if (existsSync(file)) {
      success(`✓ ${part.label.padEnd(24)}${shown}`)
    } else {
      warn(`✗ ${part.label.padEnd(24)}not installed`)
    }
  }

  let index: RegistryIndexItem[]
  try {
    index = (await createRegistryClient(registry ?? defaultRegistrySource(), config.base).index()).items
  } catch {
    blank()
    info("Components")
    warn("- the registry could not be read, so components were not classified")
    blank()
    info("WebMCP")
    step("adapter status unknown; availability is a browser runtime property")
    return
  }

  const installed = installedComponentNames(config)
  const known = index.filter((item) => item.type === "registry:ui")

  const agentNative: string[] = []
  const notMigrated: string[] = []
  const presentation: string[] = []
  const explicitSemantics: string[] = []

  for (const item of known) {
    if (!installed.has(item.name)) continue
    const status = item.agentUi?.status
    if (status === "presentation") {
      presentation.push(item.name)
    } else if (status === "explicit-semantics") {
      explicitSemantics.push(item.name)
    } else if (isAgentNative(componentPath(config, item.name), config)) {
      agentNative.push(item.name)
    } else {
      notMigrated.push(item.name)
    }
  }

  if (agentNative.length > 0 || notMigrated.length > 0) {
    blank()
    info("Components")
    for (const name of agentNative) success(`✓ ${name}`)
    for (const name of notMigrated) {
      warn(`✗ ${name.padEnd(26)}installed, but not agent-native`)
    }
  }

  if (presentation.length > 0) {
    blank()
    info("Presentation only")
    for (const name of presentation) step(name)
  }

  if (explicitSemantics.length > 0) {
    blank()
    info("Requires explicit semantics")
    for (const name of explicitSemantics) step(name)
  }

  blank()
  info("WebMCP")
  const adapterInstalled = existsSync(runtimePath(config, "webmcp.ts"))
  step(
    adapterInstalled
      ? "adapter installed; availability is a browser runtime property"
      : "adapter not installed; run `agent-ui init`",
  )
}
