import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

/**
 * End-to-end exercise of the CLI against the real registry output, in a
 * throwaway project. This is the test that proves the promise in spec section
 * 30: `add` installs an agent-native component, and `migrate` upgrades a stock
 * shadcn one without touching a single call site.
 */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const cli = join(repoRoot, "packages/cli/dist/index.js")
const registry = join(repoRoot, "apps/gallery/public/r")

/**
 * The vendored stock sources and the `components.json` style are per primitive
 * base: shadcn's `"<base>-<style>"` encoding resolves "new-york" to the Radix
 * base and "base-nova" to the Base UI base. The migrate tests run the same
 * assertions against both, each seeded with that base's own vendored stock
 * source — the bytes the per-base fingerprints were generated from.
 */
const BASES = {
  radix: {
    style: "new-york",
    fixtures: join(here, "../stock/radix"),
    // A class string in this base's stock checkbox; changing it introduces
    // drift without altering the structure or the public exports.
    checkboxDrift: ["transition-shadow outline-none", "transition-shadow outline-none bg-red-500"],
    tabsDrift: ["group/tabs flex gap-2 ", "group/tabs flex gap-2 bg-red-500 "],
  },
  base: {
    style: "base-nova",
    fixtures: join(here, "../stock/base"),
    checkboxDrift: ["transition-colors outline-none", "transition-colors outline-none bg-red-500"],
    tabsDrift: ["group/tabs flex gap-2 ", "group/tabs flex gap-2 bg-red-500 "],
  },
} as const

type BaseName = keyof typeof BASES

function createProject(components: string[], base: BaseName = "radix"): string {
  const { style, fixtures } = BASES[base]
  const dir = mkdtempSync(join(tmpdir(), "duz-ui-cli-"))
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "fixture-app",
        private: true,
        // Every dependency the registry declares is pre-satisfied, so the
        // tests exercise the CLI without touching the network.
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "radix-ui": "^1.6.7",
          "@base-ui/react": "^1.0.0",
          "lucide-react": "^0.545.0",
          "class-variance-authority": "^0.7.1",
          clsx: "^2.1.1",
          "tailwind-merge": "^3.3.1",
          "@tanstack/react-table": "^8.21.3",
        },
      },
      null,
      2,
    ),
  )
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }, null, 2),
  )
  writeFileSync(
    join(dir, "components.json"),
    JSON.stringify(
      {
        tsx: true,
        style,
        tailwind: { css: "src/index.css" },
        aliases: {
          components: "@/components",
          ui: "@/components/ui",
          lib: "@/lib",
          utils: "@/lib/utils",
        },
      },
      null,
      2,
    ),
  )
  // The global stylesheet a shadcn project has, at the point it has not yet
  // been given shadcn's own. `components.json` states where it is, which is
  // where doctor looks.
  mkdirSync(join(dir, "src"), { recursive: true })
  writeFileSync(
    join(dir, "src/index.css"),
    '@import "tailwindcss";\n@import "tw-animate-css";\n',
  )

  const uiDir = join(dir, "src/components/ui")
  mkdirSync(uiDir, { recursive: true })
  for (const name of components) {
    writeFileSync(join(uiDir, `${name}.tsx`), readFileSync(join(fixtures, `${name}.tsx`), "utf8"))
  }
  return dir
}

function run(dir: string, args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, DUZ_UI_REGISTRY: registry },
  })
  return { ...result, output: `${result.stdout}${result.stderr}` }
}

test("init installs the runtime and is safe to run twice", () => {
  const dir = createProject([])
  try {
    const first = run(dir, ["init"])
    assert.equal(first.status, 0, first.output)

    const registryFile = join(dir, "src/lib/duz-ui/registry.ts")
    const webmcpFile = join(dir, "src/lib/duz-ui/webmcp.ts")
    assert.ok(existsSync(registryFile), "capability registry must be installed")
    assert.ok(existsSync(webmcpFile), "WebMCP adapter must be installed")
    assert.ok(existsSync(join(dir, "src/lib/utils.ts")))

    const before = readFileSync(registryFile, "utf8")
    const second = run(dir, ["init"])
    assert.equal(second.status, 0, second.output)
    assert.equal(readFileSync(registryFile, "utf8"), before, "second init must not change bytes")
    assert.match(second.output, /unchanged/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("add installs a component with its runtime and rewrites aliases", () => {
  const dir = createProject([])
  try {
    const result = run(dir, ["add", "data-table"])
    assert.equal(result.status, 0, result.output)

    const dataTable = join(dir, "src/components/ui/data-table.tsx")
    assert.ok(existsSync(dataTable), "the component must be installed")
    // registryDependencies pulled the runtime and the components it imports.
    assert.ok(existsSync(join(dir, "src/lib/duz-ui/use-capability.ts")))
    assert.ok(existsSync(join(dir, "src/components/ui/table.tsx")))
    assert.ok(existsSync(join(dir, "src/components/ui/checkbox.tsx")))
    assert.ok(existsSync(join(dir, "src/components/ui/button.tsx")))

    const source = readFileSync(dataTable, "utf8")
    assert.match(source, /from "@\/lib\/duz-ui\/use-capability"/)
    assert.match(source, /from "@\/components\/ui\/table"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("add refuses an unknown component and names the real ones", () => {
  const dir = createProject([])
  try {
    const result = run(dir, ["add", "not-a-component"])
    assert.notEqual(result.status, 0)
    assert.match(result.output, /data-table/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("add refuses to overwrite a customised component", () => {
  const dir = createProject([])
  try {
    // Install the component so the project owns it.
    const first = run(dir, ["add", "tabs"])
    assert.equal(first.status, 0, first.output)

    const file = join(dir, "src/components/ui/tabs.tsx")
    const customised = `${readFileSync(file, "utf8")}// local customisation\n`
    writeFileSync(file, customised)

    // Re-running without --overwrite must refuse, leave the file untouched,
    // and point the developer at --overwrite.
    const refused = run(dir, ["add", "tabs"])
    assert.notEqual(refused.status, 0, refused.output)
    assert.equal(
      readFileSync(file, "utf8"),
      customised,
      "a customised file must be left untouched",
    )
    assert.match(
      refused.output,
      /components\/ui\/tabs\.tsx/,
      "the output must name the refused file",
    )
    assert.match(
      refused.output,
      /--overwrite/,
      "the output must mention --overwrite",
    )

    // --overwrite replaces the customised file with the registry version.
    const overwritten = run(dir, ["add", "--overwrite", "tabs"])
    assert.equal(overwritten.status, 0, overwritten.output)
    assert.notEqual(
      readFileSync(file, "utf8"),
      customised,
      "--overwrite must replace the customised file",
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("add installs the component for the project's base", () => {
  // A project whose style resolves to base must receive the Base UI
  // component; a legacy new-york project must receive the Radix one. The
  // assertion names the primitive import, which only one base's source
  // contains.
  const baseDir = createProject([], "base")
  try {
    const result = run(baseDir, ["add", "tabs"])
    assert.equal(result.status, 0, result.output)
    const source = readFileSync(join(baseDir, "src/components/ui/tabs.tsx"), "utf8")
    assert.match(
      source,
      /from "@base-ui\/react\//,
      "a base-configured project must receive the Base UI component",
    )
  } finally {
    rmSync(baseDir, { recursive: true, force: true })
  }

  const radixDir = createProject([], "radix")
  try {
    const result = run(radixDir, ["add", "tabs"])
    assert.equal(result.status, 0, result.output)
    const source = readFileSync(join(radixDir, "src/components/ui/tabs.tsx"), "utf8")
    assert.match(
      source,
      /from "radix-ui"/,
      "a radix-configured project must receive the Radix component",
    )
  } finally {
    rmSync(radixDir, { recursive: true, force: true })
  }
})

for (const base of Object.keys(BASES) as BaseName[]) {
  test(`[${base}] migrate upgrades stock shadcn components and leaves call sites alone`, () => {
    const dir = createProject(["tabs", "select", "checkbox", "dialog", "input", "button", "label"], base)
    const callSite = join(dir, "src/app.tsx")
    const callSiteSource = [
      'import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"',
      "",
      "export function App() {",
      '  return <Tabs defaultValue="account" />',
      "}",
      "",
    ].join("\n")
    writeFileSync(callSite, callSiteSource)

    try {
      const result = run(dir, ["migrate"])
      assert.equal(result.status, 0, result.output)

      const tabs = readFileSync(join(dir, "src/components/ui/tabs.tsx"), "utf8")
      assert.match(tabs, /useCapability/, "tabs must carry the capability binding")
      assert.match(tabs, /from "@\/lib\/duz-ui\/use-capability"/)
      assert.match(tabs, /export \{ Tabs, TabsList, TabsTrigger, TabsContent/, "exports must be unchanged")

      assert.equal(readFileSync(callSite, "utf8"), callSiteSource, "no call site may change")

      // Presentation-only components are reported, untouched. Button is
      // agent-native now and migrates with the rest.
      const button = readFileSync(join(dir, "src/components/ui/button.tsx"), "utf8")
      assert.match(button, /useCapability/, "button must carry the capability binding")
      assert.match(button, /from "@\/lib\/duz-ui\/use-capability"/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate is idempotent`, () => {
    const dir = createProject(["tabs", "checkbox"], base)
    try {
      assert.equal(run(dir, ["migrate"]).status, 0)
      const after = readFileSync(join(dir, "src/components/ui/tabs.tsx"), "utf8")

      const second = run(dir, ["migrate"])
      assert.equal(second.status, 0, second.output)
      assert.equal(
        readFileSync(join(dir, "src/components/ui/tabs.tsx"), "utf8"),
        after,
        "a second migrate must not change a single byte",
      )
      assert.match(second.output, /already agent-native/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate installs a registry dependency the project is missing`, () => {
    // A project that has a stock dialog.tsx but no button.tsx. The migrated
    // dialog imports @/components/ui/button, which the registry lists as a
    // registryDependency of dialog.
    const dir = createProject(["dialog"], base)
    try {
      const result = run(dir, ["migrate"])
      assert.equal(result.status, 0, result.output)

      assert.ok(
        existsSync(join(dir, "src/components/ui/button.tsx")),
        "migrate must create a missing registry dependency",
      )
      assert.match(result.output, /Dependencies created:/)
      assert.match(result.output, /components\/ui\/button\.tsx/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate refuses a locally modified component`, () => {
    const dir = createProject(["tabs"], base)
    const file = join(dir, "src/components/ui/tabs.tsx")
    const modified = `${readFileSync(file, "utf8")}\nexport function TabsSkeleton() {\n  return null\n}\n`
    writeFileSync(file, modified)

    try {
      const result = run(dir, ["migrate"])
      assert.equal(result.status, 0, result.output)
      assert.equal(readFileSync(file, "utf8"), modified, "a modified file must be left alone")
      assert.match(result.output, /TabsSkeleton/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate reports needs-overwrite for a drifted component and --overwrite replaces it`, () => {
    const dir = createProject(["tabs"], base)
    const file = join(dir, "src/components/ui/tabs.tsx")
    // Drift: change a Tailwind class so the source differs from known stock
    // without altering the structure or the public exports.
    const [tabsFrom, tabsTo] = BASES[base].tabsDrift
    const stock = readFileSync(file, "utf8")
    const drifted = stock.replace(tabsFrom, tabsTo)
    writeFileSync(file, drifted)

    try {
      const result = run(dir, ["migrate"])
      assert.equal(result.status, 0, result.output)

      // The output names the component under the needs-overwrite section and
      // points the developer at --overwrite.
      assert.match(result.output, /Needs overwrite:/)
      assert.match(result.output, /tabs/)
      assert.match(result.output, /source differs from known stock/)
      assert.match(result.output, /--overwrite/)

      // The drifted file is left untouched.
      assert.equal(
        readFileSync(file, "utf8"),
        drifted,
        "a drifted file must be left untouched without --overwrite",
      )

      // --overwrite replaces the drifted file with the agent-native version.
      const overwritten = run(dir, ["migrate", "--overwrite"])
      assert.equal(overwritten.status, 0, overwritten.output)
      const replaced = readFileSync(file, "utf8")
      assert.notEqual(replaced, drifted, "--overwrite must replace the drifted file")
      assert.match(replaced, /useCapability/, "the replacement must carry the capability binding")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate writes nothing when it migrates nothing`, () => {
    const dir = createProject(["tabs"], base)
    const file = join(dir, "src/components/ui/tabs.tsx")
    // Drift: change a Tailwind class so the source differs from known stock
    // without altering the structure or the public exports. Without --overwrite
    // this is needs-overwrite, so nothing migrates and nothing is written.
    const [tabsFrom, tabsTo] = BASES[base].tabsDrift
    const stock = readFileSync(file, "utf8")
    const drifted = stock.replace(tabsFrom, tabsTo)
    writeFileSync(file, drifted)

    const packageJsonPath = join(dir, "package.json")
    const packageJsonBefore = readFileSync(packageJsonPath, "utf8")

    try {
      const result = run(dir, ["migrate"])
      assert.equal(result.status, 0, result.output)
      assert.match(result.output, /0 components upgraded/)
      assert.equal(
        readFileSync(file, "utf8"),
        drifted,
        "the component file must be byte-identical",
      )
      assert.equal(
        existsSync(join(dir, "src/lib/duz-ui")),
        false,
        "no runtime must be installed",
      )
      assert.equal(
        readFileSync(packageJsonPath, "utf8"),
        packageJsonBefore,
        "package.json must be byte-identical",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate accepts named components and leaves the rest alone`, () => {
    const dir = createProject(["tabs", "checkbox"], base)
    const tabsFile = join(dir, "src/components/ui/tabs.tsx")
    const tabsBefore = readFileSync(tabsFile, "utf8")
    try {
      const result = run(dir, ["migrate", "checkbox"])
      assert.equal(result.status, 0, result.output)

      // The named component was migrated.
      const checkbox = readFileSync(join(dir, "src/components/ui/checkbox.tsx"), "utf8")
      assert.match(checkbox, /useCapability/, "the named component must be migrated")
      assert.match(checkbox, /from "@\/lib\/duz-ui\/use-capability"/)

      // The un-named component is untouched, byte for byte.
      assert.equal(
        readFileSync(tabsFile, "utf8"),
        tabsBefore,
        "an un-named component must be left untouched",
      )

      // The report does not mention the un-named component at all.
      assert.doesNotMatch(
        result.output,
        /tabs/,
        "the report must not mention an un-named component",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate with a named component leaves other drifted components untouched`, () => {
    const dir = createProject(["checkbox", "tabs"], base)
    const checkboxFile = join(dir, "src/components/ui/checkbox.tsx")
    const tabsFile = join(dir, "src/components/ui/tabs.tsx")

    // Drift both: change one class string in each so neither is a known stock
    // source. Without --overwrite each would be reported as needs-overwrite.
    const [checkboxFrom, checkboxTo] = BASES[base].checkboxDrift
    const checkboxDrifted = readFileSync(checkboxFile, "utf8").replace(checkboxFrom, checkboxTo)
    writeFileSync(checkboxFile, checkboxDrifted)
    const [tabsFrom, tabsTo] = BASES[base].tabsDrift
    const tabsDrifted = readFileSync(tabsFile, "utf8").replace(tabsFrom, tabsTo)
    writeFileSync(tabsFile, tabsDrifted)

    try {
      const result = run(dir, ["migrate", "checkbox", "--overwrite"])
      assert.equal(result.status, 0, result.output)

      // The named drifted component was replaced.
      assert.match(
        readFileSync(checkboxFile, "utf8"),
        /useCapability/,
        "the named drifted component must be replaced",
      )

      // The un-named drifted component is byte-identical to what was written.
      assert.equal(
        readFileSync(tabsFile, "utf8"),
        tabsDrifted,
        "a drifted component that was not named must be left untouched",
      )

      // --overwrite is scoped to what the developer named; a drifted component
      // they did not name is not swept up by it, so the report does not mention
      // it at all.
      assert.doesNotMatch(
        result.output,
        /tabs/,
        "the report must not mention a component the developer did not name",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`[${base}] migrate refuses a component the project does not have`, () => {
    const dir = createProject(["tabs", "checkbox"], base)
    const tabsFile = join(dir, "src/components/ui/tabs.tsx")
    const checkboxFile = join(dir, "src/components/ui/checkbox.tsx")
    const tabsBefore = readFileSync(tabsFile, "utf8")
    const checkboxBefore = readFileSync(checkboxFile, "utf8")
    const packageJsonPath = join(dir, "package.json")
    const packageJsonBefore = readFileSync(packageJsonPath, "utf8")
    try {
      const result = run(dir, ["migrate", "nosuchthing"])
      assert.notEqual(result.status, 0, "a missing component must fail")
      assert.match(
        result.output,
        /nosuchthing/,
        "the output must name the missing component",
      )

      // Nothing in the project changed: no component file, no runtime, no
      // package.json.
      assert.equal(
        readFileSync(tabsFile, "utf8"),
        tabsBefore,
        "no component file may change",
      )
      assert.equal(
        readFileSync(checkboxFile, "utf8"),
        checkboxBefore,
        "no component file may change",
      )
      assert.equal(
        existsSync(join(dir, "src/lib/duz-ui")),
        false,
        "no runtime must be installed",
      )
      assert.equal(
        readFileSync(packageJsonPath, "utf8"),
        packageJsonBefore,
        "package.json must be byte-identical",
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

test("doctor reports facts and repairs nothing", () => {
  const dir = createProject(["tabs", "button", "label"])
  try {
    run(dir, ["migrate"])
    const result = run(dir, ["doctor"])

    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /capability registry/)
    assert.match(result.output, /WebMCP adapter/)
    assert.match(result.output, /tabs/)
    assert.match(result.output, /button/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("doctor names a library drawn without the component that would read it", () => {
  const dir = createProject(["tabs", "button"])
  try {
    writeFileSync(
      join(dir, "src/overview.tsx"),
      [
        'import { Bar, BarChart } from "recharts"',
        'import { CheckIcon } from "lucide-react"',
        "",
        "export function Overview() {",
        "  return <BarChart data={[]}><Bar dataKey=\"total\" /><CheckIcon /></BarChart>",
        "}",
        "",
      ].join("\n"),
    )

    const result = run(dir, ["doctor"])
    assert.equal(result.status, 0, result.output)

    // recharts is declared by `chart` alone, so it names the component the
    // page is missing: the chart's numbers reach nobody until it is installed.
    assert.match(result.output, /recharts/)
    assert.match(result.output, /src\/overview\.tsx/)
    assert.match(result.output, /add chart/)

    // lucide-react is declared by twenty components, so it is infrastructure
    // and names none. Reporting it would bury the one finding that matters
    // under a line for every icon an application draws.
    assert.equal(
      /lucide-react/.test(result.output),
      false,
      `a package many components declare must not be reported: ${result.output}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("doctor says nothing about a library whose component is installed", () => {
  const dir = createProject(["tabs", "command"])
  try {
    // cmdk is `command`'s primitive, and command is installed: the
    // application drawing with it directly is how that component is used.
    writeFileSync(
      join(dir, "src/palette.tsx"),
      ['import { Command } from "cmdk"', "", "export const Palette = Command", ""].join("\n"),
    )

    const result = run(dir, ["doctor"])
    assert.equal(result.status, 0, result.output)
    assert.equal(
      /Drawn without/.test(result.output),
      false,
      `an installed component is not a finding: ${result.output}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("doctor names what a stylesheet without shadcn's own is missing", () => {
  const dir = createProject(["tabs", "button"])
  try {
    const result = run(dir, ["doctor"])
    assert.equal(result.status, 0, result.output)

    // Both halves, because a project can have inlined one and not the other:
    // the state variants every component's `data-open:` needs, and the
    // accordion keyframes whose height chain names Base UI's variable.
    assert.match(result.output, /src\/index\.css/)
    assert.match(result.output, /no state variants/)
    assert.match(result.output, /no accordion keyframes/)
    assert.match(result.output, /shadcn\/tailwind\.css/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("doctor accepts a stylesheet that imports shadcn's, and one that inlined it", () => {
  const imported = createProject(["tabs"])
  try {
    writeFileSync(
      join(imported, "src/index.css"),
      '@import "tailwindcss";\n@import "shadcn/tailwind.css";\n',
    )
    const result = run(imported, ["doctor"])
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /shadcn\/tailwind\.css is in effect/)
  } finally {
    rmSync(imported, { recursive: true, force: true })
  }

  // `shadcn eject` inlines the file instead of importing it, so the
  // definitions themselves count.
  const ejected = createProject(["tabs"])
  try {
    writeFileSync(
      join(ejected, "src/index.css"),
      [
        '@import "tailwindcss";',
        "@custom-variant data-open {",
        '  &:where([data-state="open"]) { @slot; }',
        "}",
        "@theme inline {",
        "  @keyframes accordion-down {",
        "    to { height: var(--radix-accordion-content-height, var(--accordion-panel-height, auto)); }",
        "  }",
        "}",
        "",
      ].join("\n"),
    )
    const result = run(ejected, ["doctor"])
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /shadcn\/tailwind\.css is in effect/)
  } finally {
    rmSync(ejected, { recursive: true, force: true })
  }
})

test("doctor does not create anything in an untouched project", () => {
  const dir = createProject(["tabs"])
  try {
    const result = run(dir, ["doctor"])
    assert.equal(result.status, 0, result.output)
    assert.equal(
      existsSync(join(dir, "src/lib/duz-ui")),
      false,
      "doctor must never install the runtime",
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
