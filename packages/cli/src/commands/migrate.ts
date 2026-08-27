/**
 * Agent UI — `agent-ui migrate` command.
 *
 * Migration is structural recognition followed by canonical replacement. For
 * each component file in the project's `ui` directory:
 *
 * 1. Classify the file by name (migratable / presentation / explicit-semantics
 *    / unknown).
 * 2. For migratable names, fetch the Agent UI registry item, rewrite its import
 *    aliases to the project's aliases, and run `planMigration` to decide
 *    whether the file is stock (→ replace), already migrated (→ skip), or
 *    locally modified (→ refuse).
 * 3. Apply every `migrated` outcome unless `--dry-run`.
 * 4. Install the union of migrated items' npm dependencies.
 *
 * The runtime (capability kernel + WebMCP adapter + utils) is installed first,
 * because migrated components import from it and would not compile without it.
 */

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { classify } from "../codemods/classify.js"
import {
  applyMigration,
  planMigration,
  type MigrationOutcome,
} from "../codemods/index.js"
import { loadProject, type ProjectConfig } from "../project/config.js"
import { ensureDependencies } from "../project/deps.js"
import { createRegistryClient, defaultRegistrySource } from "../registry/client.js"
import { installItems, rewriteAliases } from "../registry/install.js"
import type { RegistryItem } from "../registry/schema.js"
import { blank, error, info, success, title, warn } from "../ui/log.js"

export interface MigrateOptions {
  cwd?: string
  dryRun?: boolean
  registry?: string
}

interface FileResult {
  outcome: MigrationOutcome
  replacement: string
}

/**
 * Padded line for skipped / refused components, matching the spec layout:
 * `- card        presentation-only`
 */
function line(name: string, description: string): string {
  return `- ${name.padEnd(12)}${description}`
}

function printReport(results: FileResult[], dryRun: boolean): void {
  const migrated: Extract<MigrationOutcome, { status: "migrated" }>[] = []
  const alreadyMigrated: Extract<MigrationOutcome, { status: "already-migrated" }>[] = []
  const unsupported: Extract<MigrationOutcome, { status: "unsupported" }>[] = []
  const presentation: Extract<MigrationOutcome, { status: "presentation" }>[] = []
  const explicitSemantics: Extract<MigrationOutcome, { status: "explicit-semantics" }>[] = []
  const unknown: Extract<MigrationOutcome, { status: "unknown" }>[] = []

  for (const { outcome } of results) {
    switch (outcome.status) {
      case "migrated":
        migrated.push(outcome)
        break
      case "already-migrated":
        alreadyMigrated.push(outcome)
        break
      case "unsupported":
        unsupported.push(outcome)
        break
      case "presentation":
        presentation.push(outcome)
        break
      case "explicit-semantics":
        explicitSemantics.push(outcome)
        break
      case "unknown":
        unknown.push(outcome)
        break
    }
  }

  title("Agent UI migration")
  blank()

  let printedAny = false

  for (const o of migrated) {
    success(`\u2713 ${o.component}`)
    printedAny = true
  }
  for (const o of alreadyMigrated) {
    info(line(o.component, "already agent-native"))
    printedAny = true
  }
  for (const o of unsupported) {
    info(line(o.component, o.reason))
    printedAny = true
  }

  const skipped = [...presentation, ...explicitSemantics, ...unknown]
  if (skipped.length > 0) {
    if (printedAny) blank()
    info("Skipped:")
    for (const o of presentation) {
      warn(line(o.component, "presentation-only"))
    }
    for (const o of explicitSemantics) {
      warn(line(o.component, "explicit business semantics required"))
    }
    for (const o of unknown) {
      warn(line(o.component, "not supported yet"))
    }
    printedAny = true
  }

  if (printedAny) blank()
  const count = migrated.length
  const noun = count === 1 ? "component" : "components"
  const verb = dryRun ? "would be upgraded" : "upgraded"
  info(`${count} ${noun} ${verb}`)
}

export async function migrateCommand(options: MigrateOptions = {}): Promise<void> {
  const { cwd = process.cwd(), dryRun = false, registry } = options

  let config: ProjectConfig
  try {
    config = await loadProject(cwd)
  } catch (cause) {
    error("Could not read the project. Run from the root of a React project.", cause)
    process.exitCode = 1
    return
  }

  const client = createRegistryClient(registry ?? defaultRegistrySource())

  // Ensure the runtime is present — migrated components import from it.
  let runtimeItems: RegistryItem[]
  try {
    runtimeItems = await client.resolve(["agent-ui-runtime", "utils"])
  } catch (cause) {
    error("Could not read the Agent UI registry.", cause)
    process.exitCode = 1
    return
  }

  if (!dryRun) {
    await installItems(config, runtimeItems)
  }

  // List component files directly inside the ui directory.
  const uiDir = config.resolved.ui
  const componentFiles: string[] = existsSync(uiDir)
    ? readdirSync(uiDir, { withFileTypes: true })
        .filter(
          (d) =>
            d.isFile() &&
            (d.name.endsWith(".tsx") || d.name.endsWith(".jsx")),
        )
        .map((d) => d.name)
        .sort()
    : []

  // Classify, fetch replacement, and plan migration for each file.
  const results: FileResult[] = []
  const migratedItems: RegistryItem[] = []

  for (const fileName of componentFiles) {
    const component = fileName.replace(/\.(tsx|jsx)$/, "")
    const filePath = join(uiDir, fileName)
    const classification = classify(component)

    if (classification.kind !== "migratable") {
      // Non-migratable classifications become outcomes directly.
      let outcome: MigrationOutcome
      if (classification.kind === "presentation") {
        outcome = { status: "presentation", component }
      } else if (classification.kind === "explicit-semantics") {
        outcome = { status: "explicit-semantics", component }
      } else {
        outcome = { status: "unknown", component }
      }
      results.push({ outcome, replacement: "" })
      continue
    }

    // Fetch the registry item for this migratable component.
    let item: RegistryItem
    try {
      item = await client.item(component)
    } catch {
      results.push({
        outcome: {
          status: "unsupported",
          component,
          file: filePath,
          reason: "the registry has no item for this component",
        },
        replacement: "",
      })
      continue
    }

    const uiFile = item.files.find((f) => f.type === "registry:ui")
    if (!uiFile) {
      results.push({
        outcome: {
          status: "unsupported",
          component,
          file: filePath,
          reason: "registry item has no UI file",
        },
        replacement: "",
      })
      continue
    }

    const replacement = rewriteAliases(uiFile.content, config)
    const runtimeImportPrefix = `${config.aliases.lib}/agent-ui/`
    const outcome = planMigration({
      file: filePath,
      component,
      replacement,
      runtimeImportPrefix,
    })

    results.push({ outcome, replacement })

    if (outcome.status === "migrated") {
      migratedItems.push(item)
    }
  }

  // Apply migrations (unless --dry-run).
  if (!dryRun) {
    for (const { outcome, replacement } of results) {
      applyMigration(outcome, replacement)
    }
  }

  // Install the union of the migrated items' npm dependencies. The component
  // files themselves were just written by applyMigration, so installItems must
  // not run again here — it would rewrite what migration produced.
  if (migratedItems.length > 0 && !dryRun) {
    const dependencies = [
      ...new Set(migratedItems.flatMap((item) => item.dependencies)),
    ]
    await ensureDependencies(config, dependencies)
  }

  printReport(results, dryRun)
}
