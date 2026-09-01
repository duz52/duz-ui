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
import { displayPath, findPackageImporters } from "../project/source-scan.js"
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

/**
 * The npm package a component exists to wrap, by package.
 *
 * A package exactly one registry component declares is that component's
 * primitive: `recharts` names `chart`, `@tanstack/react-table` names
 * `data-table`. A package many components declare — an icon set, a class
 * utility — is shared infrastructure and names nothing. The split is read
 * from the registry rather than listed here, so it stays right as the
 * registry grows.
 */
function primitivePackages(index: RegistryIndexItem[]): Map<string, string> {
  const owners = new Map<string, string[]>()
  for (const item of index) {
    for (const dependency of item.dependencies) {
      const named = owners.get(dependency)
      if (named) named.push(item.name)
      else owners.set(dependency, [item.name])
    }
  }

  const primitives = new Map<string, string>()
  for (const [dependency, named] of owners) {
    if (named.length === 1) primitives.set(dependency, named[0]!)
  }
  return primitives
}

/**
 * Libraries the application draws with directly while the component that
 * would make them agent-readable is not installed.
 *
 * A chart rendered straight from recharts is geometry: its numbers never
 * reach an agent, and no report mentioned it, because nothing was wrong with
 * what *was* installed. The benchmark's chart task was unanswerable for three
 * runs for exactly this reason, and the run before this check existed gave the
 * developer a clean bill of health.
 *
 * Only agent-native components count. A presentation-only wrapper would give
 * the agent nothing it does not already have, so its absence is not a finding.
 */
function unwrappedLibraries(
  config: ProjectConfig,
  known: RegistryIndexItem[],
  installed: ReadonlySet<string>,
): { packageName: string; component: string; file: string }[] {
  const byName = new Map(known.map((item) => [item.name, item]))
  const wanted = new Map<string, string>()

  for (const [packageName, component] of primitivePackages(known)) {
    if (installed.has(component)) continue
    if (byName.get(component)?.agentUi?.status !== "agent-native") continue
    wanted.set(packageName, component)
  }

  return [...findPackageImporters(config, new Set(wanted.keys()))]
    .map(([packageName, file]) => ({
      packageName,
      component: wanted.get(packageName)!,
      file: displayPath(file, config.cwd),
    }))
    .sort((a, b) => a.component.localeCompare(b.component))
}

/**
 * What a stylesheet must provide for shadcn's components to style themselves,
 * and how to tell whether it does.
 *
 * A shadcn project imports three stylesheets — tailwindcss, tw-animate-css and
 * `shadcn/tailwind.css` — and the third is not decoration. It defines the nine
 * state variants every component is written against, each matching both
 * spellings the primitives use (`data-state="open"` and `data-open`), and the
 * accordion keyframes whose height chain includes Base UI's variable. Without
 * it Tailwind compiles `data-open:` to a bare `[data-open]`, which Radix never
 * emits, and `data-vertical:` to `[data-vertical]`, which neither primitive
 * emits: the classes are still generated, still shipped, and never match.
 *
 * `shadcn eject` inlines the file rather than importing it, so a project that
 * ejected is equally well served. Each piece is therefore looked for twice —
 * once as the import, once as the definition it would have brought.
 */
const STYLESHEET_PARTS: { label: string; inlined: RegExp }[] = [
  { label: "state variants", inlined: /@custom-variant\s+data-open\b/ },
  { label: "accordion keyframes", inlined: /--accordion-panel-height\b/ },
]

const SHADCN_STYLESHEET_IMPORT = /@import\s+["']shadcn\/tailwind\.css["']/

/** The parts of shadcn's stylesheet a project's CSS neither imports nor states. */
function missingStylesheetParts(css: string): string[] {
  if (SHADCN_STYLESHEET_IMPORT.test(css)) return []
  return STYLESHEET_PARTS.filter((part) => !part.inlined.test(css)).map((p) => p.label)
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

  for (const item of known) {
    if (!installed.has(item.name)) continue
    const status = item.agentUi?.status
    if (status === "presentation") {
      presentation.push(item.name)
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

  const unwrapped = unwrappedLibraries(config, known, installed)
  if (unwrapped.length > 0) {
    blank()
    info("Drawn without an agent-readable component")
    for (const { packageName, component, file } of unwrapped) {
      warn(`✗ ${packageName.padEnd(26)}${file}`)
      info(`  ${"".padEnd(26)}an agent cannot read it; add ${component}`)
    }
  }

  blank()
  info("Stylesheet")
  if (config.cssPath === undefined) {
    step("components.json states no tailwind.css, so none was read")
  } else {
    const shown = displayPath(config.cssPath, config.cwd)
    const missing = missingStylesheetParts(readFileSync(config.cssPath, "utf8"))
    if (missing.length === 0) {
      success(`✓ ${shown.padEnd(26)}shadcn/tailwind.css is in effect`)
    } else {
      warn(`✗ ${shown.padEnd(26)}no ${missing.join(", no ")}`)
      info(`  ${"".padEnd(26)}components style themselves through it —`)
      info(`  ${"".padEnd(26)}add \`@import "shadcn/tailwind.css";\``)
    }
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
