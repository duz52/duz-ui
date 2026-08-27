/**
 * Integration test A — one command, on a legacy shadcn app.
 *
 * Drives the real migration path against the real built registry output at
 * apps/gallery/public/r, using the same entry points the CLI uses
 * (planMigration, applyMigration, installItems, the registry client), not the
 * CLI binary. The binary is covered by cli.test.ts; a test that needs
 * `pnpm add` to reach the network is not a test.
 *
 * The fixture is a minimal project that looks like a real older shadcn app:
 * scoped @radix-ui packages, an older-generation tabs without tabsListVariants,
 * and a lib/utils.ts that carries an application-owned helper next to cn.
 *
 * Run with `pnpm --filter agent-ui test`.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  applyMigration,
  planMigration,
  type MigrationOutcome,
} from "../src/codemods/index.js"
import { classify } from "../src/codemods/classify.js"
import { loadProject } from "../src/project/config.js"
import { createRegistryClient } from "../src/registry/client.js"
import { installItems, rewriteAliases } from "../src/registry/install.js"
import { withTempProject } from "./helpers.js"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const fixtureDir = join(here, "fixtures", "legacy-app")
const registryDir = join(repoRoot, "apps/gallery/public/r")

/**
 * The fixture files, in the relative shape `withTempProject` expects. The
 * fixture's package.json and tsconfig.json overwrite the defaults
 * `withTempProject` writes, so the temp project carries the scoped radix
 * packages and the @/* → ./src/* path mapping a real shadcn app has.
 */
const FIXTURE_PATHS = [
  "components.json",
  "package.json",
  "tsconfig.json",
  "src/lib/utils.ts",
  "src/components/ui/tabs.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/button.tsx",
] as const

function readFixtureFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const rel of FIXTURE_PATHS) {
    files[rel] = readFileSync(join(fixtureDir, rel), "utf8")
  }
  return files
}

interface MigrationResult {
  outcomes: Map<string, MigrationOutcome>
}

/**
 * Replicates the `agent-ui migrate` flow using the CLI's own entry points:
 * load the project config, install the runtime from the registry, classify
 * each component file, plan migration for migratable ones, and apply. Does
 * not spawn the CLI binary and does not call ensureDependencies for the
 * migrated items — their npm deps are pre-satisfied in the fixture, and a
 * test that reaches the network is not a test.
 */
async function runMigration(dir: string, overwrite: boolean = false): Promise<MigrationResult> {
  const config = await loadProject(dir)
  const client = createRegistryClient(registryDir)

  // The runtime (capability kernel + WebMCP adapter + utils) is installed
  // first, because migrated components import from it.
  const runtimeItems = await client.resolve(["agent-ui-runtime", "utils"])
  await installItems(config, runtimeItems)

  const uiDir = config.resolved.ui
  const componentFiles: string[] = existsSync(uiDir)
    ? readdirSync(uiDir, { withFileTypes: true })
        .filter((d) => d.isFile() && (d.name.endsWith(".tsx") || d.name.endsWith(".jsx")))
        .map((d) => d.name)
        .sort()
    : []

  const results: Array<{ outcome: MigrationOutcome; replacement: string }> = []

  for (const fileName of componentFiles) {
    const component = fileName.replace(/\.(tsx|jsx)$/, "")
    const filePath = join(uiDir, fileName)
    const classification = classify(component)

    if (classification.kind !== "migratable") {
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

    const item = await client.item(component)
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
      overwrite,
    })
    results.push({ outcome, replacement })
  }

  for (const { outcome, replacement } of results) {
    applyMigration(outcome, replacement)
  }

  return {
    outcomes: new Map(results.map((r) => [r.outcome.component, r.outcome])),
  }
}

/** Snapshot every file under src/ as a relative-path → content map. */
function snapshotSrc(dir: string): Map<string, string> {
  const snapshot = new Map<string, string>()
  const srcDir = join(dir, "src")
  if (!existsSync(srcDir)) return snapshot
  function walk(d: string): void {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) {
        walk(path)
      } else {
        snapshot.set(relative(dir, path), readFileSync(path, "utf8"))
      }
    }
  }
  walk(srcDir)
  return snapshot
}

describe("migrate against a legacy shadcn app", () => {
  it("recognises the older generation as needs-overwrite and leaves bytes unchanged", async () => {
    await withTempProject(readFixtureFiles(), async (dir) => {
      const uiDir = join(dir, "src/components/ui")
      const before = new Map<string, string>()
      for (const name of readdirSync(uiDir)) {
        before.set(name, readFileSync(join(uiDir, name), "utf8"))
      }

      const first = await runMigration(dir)

      // 1. tabs, checkbox and select are needs-overwrite — the older
      //    generation is recognised but its source differs from known stock.
      assert.equal(first.outcomes.get("tabs")?.status, "needs-overwrite")
      assert.equal(first.outcomes.get("checkbox")?.status, "needs-overwrite")
      assert.equal(first.outcomes.get("select")?.status, "needs-overwrite")

      // 2. card is presentation and button is explicit-semantics.
      assert.equal(first.outcomes.get("card")?.status, "presentation")
      assert.equal(first.outcomes.get("button")?.status, "explicit-semantics")

      // 3. No component file may change on a plain run.
      for (const [name, content] of before) {
        assert.equal(
          readFileSync(join(uiDir, name), "utf8"),
          content,
          `component ${name} must be left untouched`,
        )
      }
    })
  })

  it("with overwrite, migrates the older generation and preserves project-owned code", async () => {
    await withTempProject(readFixtureFiles(), async (dir) => {
      const result = await runMigration(dir, true)

      // tabs, checkbox and select migrate when overwrite is given.
      assert.equal(result.outcomes.get("tabs")?.status, "migrated")
      assert.equal(result.outcomes.get("checkbox")?.status, "migrated")
      assert.equal(result.outcomes.get("select")?.status, "migrated")

      // The app's own extra function in lib/utils.ts survives migration.
      // This is the regression test for a bug that deleted three functions
      // from a real project's utils.ts.
      const utilsContent = readFileSync(join(dir, "src/lib/utils.ts"), "utf8")
      assert.match(utilsContent, /formatPrice/, "project-owned code in utils.ts must survive migration")
    })
  })

  it("is idempotent — a second pass after overwrite yields zero migrated outcomes and byte-identical files", async () => {
    await withTempProject(readFixtureFiles(), async (dir) => {
      await runMigration(dir, true)
      const snapshot = snapshotSrc(dir)

      const second = await runMigration(dir)

      const migratedCount = [...second.outcomes.values()].filter(
        (o) => o.status === "migrated",
      ).length
      assert.equal(migratedCount, 0, "second pass must yield zero migrated outcomes")

      const after = snapshotSrc(dir)
      assert.equal(after.size, snapshot.size, "file count must not change on the second pass")
      for (const [rel, content] of snapshot) {
        assert.equal(
          after.get(rel),
          content,
          `file ${rel} must be byte-identical after the second pass`,
        )
      }
    })
  })
})
