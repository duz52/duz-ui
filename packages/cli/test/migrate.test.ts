/**
 * Tests for the migration codemod: `planMigration`, `applyMigration`, and
 * `classify`. Run with `pnpm --filter agent-ui test`.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { planMigration, applyMigration } from "../src/codemods/index.js"
import { classify } from "../src/codemods/classify.js"
import { withTempProject } from "./helpers.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, "fixtures", "shadcn")

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.tsx`), "utf8")
}

/**
 * A minimal replacement that carries an Agent UI runtime import. Used to verify
 * the idempotence gate — `planMigration` must recognise the `@/lib/agent-ui/`
 * import prefix and report `already-migrated` without touching the file.
 */
const AGENT_UI_REPLACEMENT = [
  '"use client"',
  "",
  'import { useTabsCapability } from "@/lib/agent-ui/tabs"',
  'import { Tabs as TabsPrimitive } from "radix-ui"',
  "",
  "function Tabs() {}",
  "function TabsList() {}",
  "function TabsTrigger() {}",
  "function TabsContent() {}",
  "",
  "export { Tabs, TabsList, TabsTrigger, TabsContent }",
  "",
].join("\n")

const RUNTIME_PREFIX = "@/lib/agent-ui/"

function plan(file: string, component: string, replacement = "") {
  return planMigration({
    file,
    component,
    replacement,
    runtimeImportPrefix: RUNTIME_PREFIX,
  })
}

describe("planMigration — recognition", () => {
  it("recognises stock tabs as migratable", async () => {
    await withTempProject(
      { "components/ui/tabs.tsx": readFixture("tabs") },
      async (dir) => {
        const outcome = plan(join(dir, "components/ui/tabs.tsx"), "tabs")
        assert.equal(outcome.status, "migrated")
      },
    )
  })

  it("recognises every migratable stock component", async () => {
    const names = ["tabs", "select", "checkbox", "dialog", "input"]
    for (const name of names) {
      await withTempProject(
        { [`components/ui/${name}.tsx`]: readFixture(name) },
        async (dir) => {
          const outcome = plan(join(dir, `components/ui/${name}.tsx`), name)
          assert.equal(outcome.status, "migrated", `${name} should be migratable`)
        },
      )
    }
  })
})

describe("planMigration — idempotence (spec section 18)", () => {
  it("reports already-migrated and does not rewrite bytes", async () => {
    await withTempProject(
      { "components/ui/tabs.tsx": AGENT_UI_REPLACEMENT },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const before = readFileSync(file, "utf8")

        const outcome = plan(file, "tabs", AGENT_UI_REPLACEMENT)
        assert.equal(outcome.status, "already-migrated")

        // applyMigration on a non-migrated outcome is a no-op.
        applyMigration(outcome, AGENT_UI_REPLACEMENT)

        const after = readFileSync(file, "utf8")
        assert.equal(before, after)
      },
    )
  })
})

describe("planMigration — locally modified is refused", () => {
  it("rejects an extra exported component appended to tabs", async () => {
    const modified = readFixture("tabs").replace(
      "export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }",
      'function SelectSkeleton() { return null }\nexport { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, SelectSkeleton }',
    )

    await withTempProject(
      { "components/ui/tabs.tsx": modified },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const before = readFileSync(file, "utf8")

        const outcome = plan(file, "tabs")
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(outcome.reason, /SelectSkeleton/)
        }

        applyMigration(outcome, "")
        const after = readFileSync(file, "utf8")
        assert.equal(before, after)
      },
    )
  })
})

describe("planMigration — missing export is refused", () => {
  it("rejects tabs when TabsContent is removed from the export list", async () => {
    const modified = readFixture("tabs").replace(", TabsContent", "")

    await withTempProject(
      { "components/ui/tabs.tsx": modified },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const outcome = plan(file, "tabs")
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(outcome.reason, /TabsContent/)
        }
      },
    )
  })
})

describe("classify", () => {
  it("classifies button as explicit-semantics", () => {
    assert.deepEqual(classify("button"), { kind: "explicit-semantics" })
  })

  it("classifies card as presentation", () => {
    assert.deepEqual(classify("card"), { kind: "presentation" })
  })

  it("classifies data-table as unknown", () => {
    assert.deepEqual(classify("data-table"), { kind: "unknown" })
  })

  it("classifies tabs as migratable", () => {
    assert.deepEqual(classify("tabs"), { kind: "migratable", name: "tabs" })
  })
})
