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
const fixtures = join(here, "fixtures/shadcn")

function createProject(components: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-ui-cli-"))
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
    env: { ...process.env, AGENT_UI_REGISTRY: registry },
  })
  return { ...result, output: `${result.stdout}${result.stderr}` }
}

test("init installs the runtime and is safe to run twice", () => {
  const dir = createProject([])
  try {
    const first = run(dir, ["init"])
    assert.equal(first.status, 0, first.output)

    const registryFile = join(dir, "src/lib/agent-ui/registry.ts")
    const webmcpFile = join(dir, "src/lib/agent-ui/webmcp.ts")
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
    assert.ok(existsSync(join(dir, "src/lib/agent-ui/use-capability.ts")))
    assert.ok(existsSync(join(dir, "src/components/ui/table.tsx")))
    assert.ok(existsSync(join(dir, "src/components/ui/checkbox.tsx")))
    assert.ok(existsSync(join(dir, "src/components/ui/button.tsx")))

    const source = readFileSync(dataTable, "utf8")
    assert.match(source, /from "@\/lib\/agent-ui\/use-capability"/)
    assert.match(source, /from "@\/components\/ui\/table"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("add refuses an unknown component and names the real ones", () => {
  const dir = createProject([])
  try {
    const result = run(dir, ["add", "carousel"])
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

test("migrate upgrades stock shadcn components and leaves call sites alone", () => {
  const dir = createProject(["tabs", "select", "checkbox", "dialog", "input", "button", "label"])
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
    assert.match(tabs, /from "@\/lib\/agent-ui\/use-capability"/)
    assert.match(tabs, /export \{ Tabs, TabsList, TabsTrigger, TabsContent/, "exports must be unchanged")

    assert.equal(readFileSync(callSite, "utf8"), callSiteSource, "no call site may change")

    // Presentation-only and business-semantics components are reported, untouched.
    assert.match(result.output, /button/)
    const button = readFileSync(join(dir, "src/components/ui/button.tsx"), "utf8")
    assert.doesNotMatch(button, /agent-ui/, "button must never become an agent action")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("migrate is idempotent", () => {
  const dir = createProject(["tabs", "checkbox"])
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

test("migrate installs a registry dependency the project is missing", () => {
  // A project that has a stock dialog.tsx but no button.tsx. The migrated
  // dialog imports @/components/ui/button, which the registry lists as a
  // registryDependency of dialog.
  const dir = createProject(["dialog"])
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

test("migrate refuses a locally modified component", () => {
  const dir = createProject(["tabs"])
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

test("migrate reports needs-overwrite for a drifted component and --overwrite replaces it", () => {
  const dir = createProject(["tabs"])
  const file = join(dir, "src/components/ui/tabs.tsx")
  // Drift: change a Tailwind class so the source differs from known stock
  // without altering the structure or the public exports.
  const stock = readFileSync(file, "utf8")
  const drifted = stock.replace("flex-1 outline-none", "flex-1 outline-none bg-red-500")
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

test("doctor does not create anything in an untouched project", () => {
  const dir = createProject(["tabs"])
  try {
    const result = run(dir, ["doctor"])
    assert.equal(result.status, 0, result.output)
    assert.equal(
      existsSync(join(dir, "src/lib/agent-ui")),
      false,
      "doctor must never install the runtime",
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
