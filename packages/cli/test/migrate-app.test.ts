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
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { delimiter, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  applyMigration,
  planMigration,
  type MigrationOutcome,
} from "../src/codemods/index.js"
import { classify } from "../src/codemods/classify.js"
import { refuseBreakingMigrations } from "../src/codemods/mixing.js"
import { loadProject } from "../src/project/config.js"
import { ensureDependencies } from "../src/project/deps.js"
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

/**
 * The project's own file that would break: it value-imports the trigger
 * directly from the primitive package the stock tabs implementation used,
 * alongside the project's own ui module. One module instance, one React
 * context — until migration replaces the ui module with an implementation
 * importing from the unified `radix-ui` package.
 */
const MIXING_VIEW_OPTIONS = [
  'import { TabsTrigger } from "@radix-ui/react-tabs"',
  'import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs"',
  "",
  "export function ViewOptions() {",
  "  return (",
  '    <Tabs defaultValue="columns">',
  "      <TabsList>",
  '        <TabsTrigger value="columns">Columns</TabsTrigger>',
  "      </TabsList>",
  '      <TabsContent value="columns">Table</TabsContent>',
  "    </Tabs>",
  "  )",
  "}",
  "",
].join("\n")

/**
 * Self-consistent: the primitive is imported directly and the project's own
 * ui module for that component is never touched, so no context is shared and
 * nothing the replacement does can strand the file.
 */
const RAW_PRIMITIVE_ONLY = [
  'import { Checkbox as CheckboxPrimitive } from "@radix-ui/react-checkbox"',
  "",
  "export function ConfigDrawer() {",
  "  return <CheckboxPrimitive defaultChecked />",
  "}",
  "",
].join("\n")

/**
 * Type-only primitive imports are erased at compile time: they bind no module
 * instance, so the ui module's implementation stays the only one.
 */
const TYPE_ONLY_PRIMITIVE = [
  'import type { TabsProps } from "@radix-ui/react-tabs"',
  'import { type TabsContentProps } from "@radix-ui/react-tabs"',
  'import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"',
  "",
  "export function LearnMore(props: TabsProps) {",
  "  return (",
  '    <Tabs defaultValue="learn">',
  "      <TabsList>",
  '        <TabsTrigger value="learn">Learn more</TabsTrigger>',
  "      </TabsList>",
  '      <TabsContent value="learn">{props.activationMode}</TabsContent>',
  "    </Tabs>",
  "  )",
  "}",
  "",
].join("\n")

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
      config,
    })
    results.push({ outcome, replacement })
  }

  // The same refusal pass `agent-ui migrate` runs between planning and
  // writing: a replacement that would strand files mixing the project's own
  // ui module with a direct primitive import is reported unsupported.
  refuseBreakingMigrations(results, config)

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

/** Asserts the outcome is `unsupported` and returns its reason. */
function refusedReason(outcome: MigrationOutcome | undefined): string {
  if (outcome?.status !== "unsupported") {
    assert.fail(`expected an unsupported outcome, got ${outcome?.status ?? "no outcome"}`)
  }
  return outcome.reason
}

/**
 * A fake `pnpm`: an executable script plus the lockfile that makes
 * `detectPackageManager` resolve to pnpm. Returns the bin directory to
 * prepend to the PATH.
 */
function writeFakePnpm(dir: string, script: string[]): string {
  const binDir = join(dir, "fake-bin")
  mkdirSync(binDir)
  const pnpm = join(binDir, "pnpm")
  writeFileSync(pnpm, [...script, ""].join("\n"))
  chmodSync(pnpm, 0o755)
  writeFileSync(join(dir, "pnpm-lock.yaml"), "")
  return binDir
}

/**
 * Prepends `binDir` to the PATH for the duration of `fn`, so the fake package
 * manager is the one `ensureDependencies` spawns. Restores the PATH even when
 * `fn` throws.
 */
async function withPathPrefix<T>(binDir: string, fn: () => Promise<T>): Promise<T> {
  const originalPath = process.env.PATH
  process.env.PATH = `${binDir}${delimiter}${originalPath ?? ""}`
  try {
    return await fn()
  } finally {
    process.env.PATH = originalPath
  }
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

      // 2. card is unmodified stock, so a plain run migrates it in place;
      //    button is an older generation, recognised but differing from
      //    known stock.
      assert.equal(first.outcomes.get("card")?.status, "migrated")
      assert.equal(first.outcomes.get("button")?.status, "needs-overwrite")

      // 3. No other component file may change on a plain run.
      for (const [name, content] of before) {
        if (name === "card.tsx") continue
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

describe("migration refuses components whose replacement would break primitive mixing", () => {
  it("refuses to migrate a component whose replacement would break a file that mixes the primitive with the ui module", async () => {
    await withTempProject(
      { ...readFixtureFiles(), "src/components/data-table/view-options.tsx": MIXING_VIEW_OPTIONS },
      async (dir) => {
        const tabsBefore = readFileSync(join(dir, "src/components/ui/tabs.tsx"), "utf8")

        const result = await runMigration(dir, true)

        const reason = refusedReason(result.outcomes.get("tabs"))
        assert.match(
          reason,
          /would break src\/components\/data-table\/view-options\.tsx,\nwhich imports TabsTrigger from @radix-ui\/react-tabs/,
        )

        // Refusing is per component: the mixing file only touches tabs.
        assert.equal(result.outcomes.get("checkbox")?.status, "migrated")
        assert.equal(result.outcomes.get("select")?.status, "migrated")

        // The refused component's file is left byte-identical.
        assert.equal(readFileSync(join(dir, "src/components/ui/tabs.tsx"), "utf8"), tabsBefore)
      },
    )
  })

  it("migrates a component whose primitive is imported directly but never alongside the ui module", async () => {
    await withTempProject(
      { ...readFixtureFiles(), "src/components/settings/config-drawer.tsx": RAW_PRIMITIVE_ONLY },
      async (dir) => {
        const result = await runMigration(dir, true)

        // Self-consistent: the file uses the primitive directly and never
        // touches the project's own ui module for it.
        assert.equal(result.outcomes.get("checkbox")?.status, "migrated")
      },
    )
  })

  it("migrates when the project file's primitive imports are type-only", async () => {
    await withTempProject(
      { ...readFixtureFiles(), "src/components/learn-more.tsx": TYPE_ONLY_PRIMITIVE },
      async (dir) => {
        const result = await runMigration(dir, true)

        // Type-only imports bind no module instance, so the ui module's
        // implementation stays the only one.
        assert.equal(result.outcomes.get("tabs")?.status, "migrated")
      },
    )
  })
})

describe("dependency installation during migration", () => {
  it("treats a dependency as installed when package.json declares it, even though the package manager exited non-zero", async () => {
    await withTempProject({}, async (dir) => {
      // Reproduces ERR_PNPM_IGNORED_BUILDS: the dependencies are written to
      // package.json, then the package manager exits non-zero because build
      // scripts await approval — not because the install failed.
      const binDir = writeFakePnpm(dir, [
        "#!/bin/sh",
        "node -e \"const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.dependencies['radix-ui'] = '^1.0.0'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))\"",
        "exit 1",
      ])

      const config = await loadProject(dir)
      const installed = await withPathPrefix(binDir, () =>
        ensureDependencies(config, ["radix-ui"]),
      )

      assert.deepEqual(installed, ["radix-ui"])
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        dependencies: Record<string, string>
      }
      assert.equal(pkg.dependencies["radix-ui"], "^1.0.0")
    })
  })

  it("throws, naming the exit status, when the dependency is genuinely still missing", async () => {
    await withTempProject({}, async (dir) => {
      const binDir = writeFakePnpm(dir, ["#!/bin/sh", "exit 1"])

      const config = await loadProject(dir)
      await withPathPrefix(binDir, () =>
        assert.rejects(
          ensureDependencies(config, ["radix-ui"]),
          /Could not install dependencies \(exit status 1\)/,
        ),
      )
    })
  })
})
