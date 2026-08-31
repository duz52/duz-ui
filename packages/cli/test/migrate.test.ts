/**
 * Tests for the migration codemod: `planMigration`, `applyMigration`, and
 * `classify`. Run with `pnpm --filter agent-ui test`.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { planMigration, applyMigration } from "../src/codemods/index.js"
import { classify } from "../src/codemods/classify.js"
import { SIGNATURES } from "../src/codemods/signatures.js"
import { loadProject } from "../src/project/config.js"
import { rewriteAliases } from "../src/registry/install.js"
import { withTempProject } from "./helpers.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
// The fingerprints in stock-fingerprints.ts are generated from these bytes,
// so a test that reads anything else is testing a copy that can silently
// drift from the source the fingerprints were computed against. The stock
// sources are vendored per primitive base.
const fixturesDir = join(__dirname, "../stock")

/**
 * The primitive bases the stock fixtures are vendored for, and the
 * `components.json` style that resolves to each. Every temp project must
 * carry a components.json naming its base: an absent style resolves to the
 * Base UI base, which would match the wrong signature and fingerprint set.
 */
const BASES = {
  radix: { style: "new-york", fixtures: join(fixturesDir, "radix") },
  base: { style: "base-nova", fixtures: join(fixturesDir, "base") },
} as const

type StockBase = keyof typeof BASES

function readFixture(base: StockBase, name: string): string {
  return readFileSync(join(BASES[base].fixtures, `${name}.tsx`), "utf8")
}

/**
 * A components.json for `base`, merged into the temp project's files so
 * `loadProject` resolves the project to that base.
 */
function baseConfig(base: StockBase): string {
  return JSON.stringify({ tsx: true, style: BASES[base].style })
}

/**
 * Build a minimal replacement that carries the Agent UI runtime import and
 * exports every name the signature requires. Derived from SIGNATURES so a
 * signature added tomorrow is covered without anyone remembering to hand-write
 * a matching stub. The stub is intentionally minimal — the recognition test
 * checks that planMigration identifies known stock, not that the replacement is
 * the real Agent UI implementation.
 */
function stubReplacement(name: string): string {
  const signature = SIGNATURES.find((s) => s.name === name)
  if (!signature) {
    throw new Error(`No signature for "${name}"`)
  }
  const exports = [...signature.requiredExports, ...signature.internalDeclarations]
  const functions = signature.requiredExports
    .map((n) => `function ${n}() {\n  return null\n}`)
    .join("\n")
  const consts = signature.internalDeclarations
    .map((n) => `const ${n} = null`)
    .join("\n")
  const body = [functions, consts].filter((s) => s.length > 0).join("\n")
  return [
    'import { useCapability } from "@/lib/agent-ui/use-capability"',
    "",
    body,
    "",
    `export { ${exports.join(", ")} }`,
    "",
  ].join("\n")
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

/**
 * Wraps `planMigration` with the same inputs the `agent-ui migrate` command
 * supplies: the project config is loaded with `loadProject` against the
 * temp project, never hand-constructed. A test that invents its own config
 * is testing a fiction.
 */
async function plan(
  dir: string,
  file: string,
  component: string,
  replacement = stubReplacement(component),
  overwrite = false,
) {
  const config = await loadProject(dir)
  return planMigration({
    file,
    component,
    replacement,
    runtimeImportPrefix: RUNTIME_PREFIX,
    overwrite,
    config,
  })
}

describe("planMigration — recognition", () => {
  for (const base of Object.keys(BASES) as StockBase[]) {
    it(`recognises stock tabs as migratable (${base})`, async () => {
      await withTempProject(
        {
          "components.json": baseConfig(base),
          "components/ui/tabs.tsx": readFixture(base, "tabs"),
        },
        async (dir) => {
          const outcome = await plan(dir, join(dir, "components/ui/tabs.tsx"), "tabs")
          assert.equal(outcome.status, "migrated")
        },
      )
    })

    it(`recognises every migratable stock component (${base})`, async () => {
      // Derived from SIGNATURES so a signature added tomorrow is covered
      // without anyone remembering to extend a hardcoded list.
      const names = SIGNATURES.map((s) => s.name)
      for (const name of names) {
        await withTempProject(
          {
            "components.json": baseConfig(base),
            [`components/ui/${name}.tsx`]: readFixture(base, name),
          },
          async (dir) => {
            const outcome = await plan(dir, join(dir, `components/ui/${name}.tsx`), name)
            assert.equal(outcome.status, "migrated", `${name} should be migratable on ${base}`)
          },
        )
      }
    })
  }

})

describe("planMigration — idempotence (spec section 18)", () => {
  it("reports already-migrated and does not rewrite bytes", async () => {
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/tabs.tsx": AGENT_UI_REPLACEMENT,
      },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const before = readFileSync(file, "utf8")

        const outcome = await plan(dir, file, "tabs", AGENT_UI_REPLACEMENT)
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
    const modified = readFixture("radix", "tabs").replace(
      "export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }",
      'function SelectSkeleton() { return null }\nexport { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, SelectSkeleton }',
    )

    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/tabs.tsx": modified,
      },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const before = readFileSync(file, "utf8")

        const outcome = await plan(dir, file, "tabs")
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
    const modified = readFixture("radix", "tabs").replace(", TabsContent", "")

    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/tabs.tsx": modified,
      },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const outcome = await plan(dir, file, "tabs")
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(outcome.reason, /TabsContent/)
        }
      },
    )
  })
})

describe("recognition and compatibility are separate facts", () => {
  it("refuses a replacement that would drop an export", async () => {
    const replacement = stubReplacement("tabs").replace(", TabsContent", "")
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/tabs.tsx": readFixture("radix", "tabs"),
      },
      async (dir) => {
        const outcome = await plan(
          dir,
          join(dir, "components/ui/tabs.tsx"),
          "tabs",
          replacement,
        )
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(outcome.reason, /TabsContent/)
        }
      },
    )
  })

  it("refuses a locally modified file even when the replacement is export-compatible", async () => {
    // Append a top-level helper that is not part of the stock signature. The
    // file's exports are unchanged, so the replacement still covers every one
    // (the stock file migrates with the same replacement); only recognition
    // fails, naming the added declaration.
    const modified = readFixture("radix", "tabs") + "\nconst myHelper = 1\n"
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/tabs.tsx": modified,
      },
      async (dir) => {
        const file = join(dir, "components/ui/tabs.tsx")
        const outcome = await plan(dir, file, "tabs")
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(
            outcome.reason,
            /unexpected top-level declaration "myHelper"/,
          )
        }
      },
    )
  })
})

describe("ownership gate", () => {
  // Drift is produced by changing one Tailwind class string in the vendored
  // stock fixture, not by hand-writing a second copy of the component. The
  // fingerprint is sensitive to class-string changes, so this is no longer
  // known stock; the exports and top-level declarations are unchanged, so it
  // is still a recognised candidate with a preserved public contract.
  const driftedCheckbox = readFixture("radix", "checkbox").replace(
    "rounded-[4px]",
    "rounded-lg",
  )

  it("reports needs-overwrite for a drifted stock file and leaves bytes unchanged", async () => {
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/checkbox.tsx": driftedCheckbox,
      },
      async (dir) => {
        const file = join(dir, "components/ui/checkbox.tsx")
        const before = readFileSync(file, "utf8")

        const outcome = await plan(dir, file, "checkbox")
        assert.equal(outcome.status, "needs-overwrite")

        applyMigration(outcome, stubReplacement("checkbox"))

        const after = readFileSync(file, "utf8")
        assert.equal(before, after)
      },
    )
  })

  it("migrates the same drifted file when overwrite is true", async () => {
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/checkbox.tsx": driftedCheckbox,
      },
      async (dir) => {
        const file = join(dir, "components/ui/checkbox.tsx")
        const outcome = await plan(dir, file, "checkbox", stubReplacement("checkbox"), true)
        assert.equal(outcome.status, "migrated")
      },
    )
  })

  it("refuses a drifted file that exports a name the replacement drops, even with overwrite", async () => {
    // Re-exporting an extra name from an external module keeps the file a
    // recognised candidate (export declarations are always allowed and the
    // primitive-import count is unchanged) while breaking export preservation.
    const driftedWithExtraExport =
      driftedCheckbox + '\nexport { Loader2 } from "lucide-react"\n'

    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/checkbox.tsx": driftedWithExtraExport,
      },
      async (dir) => {
        const file = join(dir, "components/ui/checkbox.tsx")
        const outcome = await plan(dir, file, "checkbox", stubReplacement("checkbox"), true)
        assert.equal(outcome.status, "unsupported")
        if (outcome.status === "unsupported") {
          assert.match(outcome.reason, /Loader2/)
        }
      },
    )
  })

  it("migrates an untouched stock file without any flag", async () => {
    await withTempProject(
      {
        "components.json": baseConfig("radix"),
        "components/ui/checkbox.tsx": readFixture("radix", "checkbox"),
      },
      async (dir) => {
        const outcome = await plan(dir, join(dir, "components/ui/checkbox.tsx"), "checkbox")
        assert.equal(outcome.status, "migrated")
      },
    )
  })
})

describe("aliases are configuration, not drift", () => {
  // A project whose components.json sets non-default aliases: utils → @/utils
  // and ui → @/ui. The stock fixture's import specifiers are rewritten to
  // match, the same way install.ts would when writing the file. The style is
  // pinned to radix so the project resolves to the radix signatures and
  // fingerprints the fixture belongs to.
  const nonDefaultAliases = JSON.stringify({
    tsx: true,
    style: "new-york",
    aliases: { components: "@/components", ui: "@/ui", lib: "@/lib", utils: "@/utils" },
  })

  it("migrates a stock fixture whose imports use non-default aliases", async () => {
    await withTempProject(
      {
        "components.json": nonDefaultAliases,
        "components/ui/checkbox.tsx": readFixture("radix", "checkbox"),
      },
      async (dir) => {
        const config = await loadProject(dir)
        // Build the source by rewriting the fixture's specifiers, not by
        // hand-writing a second copy.
        const source = rewriteAliases(readFixture("radix", "checkbox"), config)
        const file = join(dir, "components/ui/checkbox.tsx")
        writeFileSync(file, source)

        const outcome = await plan(dir, file, "checkbox", stubReplacement("checkbox"), false)
        assert.equal(outcome.status, "migrated")
      },
    )
  })

  it("still reports needs-overwrite when a class string is changed under non-default aliases", async () => {
    await withTempProject(
      {
        "components.json": nonDefaultAliases,
        "components/ui/checkbox.tsx": readFixture("radix", "checkbox"),
      },
      async (dir) => {
        const config = await loadProject(dir)
        // Rewrite specifiers to non-default aliases, then introduce real drift
        // by changing a class string. Canonicalising imports must not hide
        // this real modification.
        const source = rewriteAliases(
          readFixture("radix", "checkbox").replace("rounded-[4px]", "rounded-lg"),
          config,
        )
        const file = join(dir, "components/ui/checkbox.tsx")
        writeFileSync(file, source)

        const outcome = await plan(dir, file, "checkbox", stubReplacement("checkbox"), false)
        assert.equal(outcome.status, "needs-overwrite")
      },
    )
  })
})

describe("classify", () => {
  it("classifies button as migratable", () => {
    assert.deepEqual(classify("button"), { kind: "migratable", name: "button" })
  })

  it("classifies card as migratable", () => {
    assert.deepEqual(classify("card"), { kind: "migratable", name: "card" })
  })

  it("classifies table as migratable", () => {
    assert.deepEqual(classify("table"), { kind: "migratable", name: "table" })
  })

  it("classifies data-table as unknown", () => {
    assert.deepEqual(classify("data-table"), { kind: "unknown" })
  })

  it("classifies tabs as migratable", () => {
    assert.deepEqual(classify("tabs"), { kind: "migratable", name: "tabs" })
  })
})
