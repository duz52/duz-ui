#!/usr/bin/env node
/**
 * Populates the gallery by running the real `duz-ui` CLI against the real
 * registry output.
 *
 * The gallery is not allowed a demo-only implementation path (spec section 20):
 * every component and runtime file it renders must be the same source a user
 * receives from `npx duz-ui add`. Running the CLI here is what proves that.
 *
 * The CLI takes both the base and the install location from `components.json`
 * (`style` names the base, the `ui` alias the directory), so the script runs
 * one pass per base, each with that base's `style` and `ui` alias written into
 * the committed `components.json`: the base's components land in
 * `app/components/<base>/ui/` and import each other through that base's alias.
 * The file the last pass leaves behind is the committed state; no temporary
 * file is written.
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "packages/cli/dist/index.js")
const gallery = path.join(root, "apps/gallery")
const registry = path.join(root, "apps/gallery/public/r")

if (!existsSync(cli)) {
  console.error("duz-ui CLI is not built. Run `pnpm build:cli` first.")
  process.exit(1)
}

if (!existsSync(path.join(registry, "registry.json"))) {
  console.error("Registry is not built. Run `pnpm build:registry` first.")
  process.exit(1)
}

// The built registry index is the same document the CLI serves, so the
// gallery installs exactly what `npx duz-ui add` installs. An item's
// `bases` field says which bases carry it, and an item may exist in only
// one — the index is the authority, never a hardcoded list.
const registryIndex = JSON.parse(readFileSync(path.join(registry, "registry.json"), "utf8"))
const uiItems = registryIndex.items.filter((item) => item.type === "registry:ui")

// Bases sorted so the passes — and the committed `components.json` the last
// one leaves — are deterministic.
const BASES = [...new Set(uiItems.flatMap((item) => item.bases ?? []))].sort()

if (BASES.length === 0) {
  console.error("Registry index lists no registry:ui item for any base. Run `pnpm build:registry` first.")
  process.exit(1)
}

const componentsJsonPath = path.join(gallery, "components.json")
const componentsJsonTemplate = JSON.parse(readFileSync(componentsJsonPath, "utf8"))

/**
 * Point the CLI at one base: `style` selects it through shadcn's
 * `<base>-<style>` encoding, the `ui` alias selects the directory the
 * component files are written to and import each other through.
 */
function writeComponentsJson(base) {
  writeFileSync(
    componentsJsonPath,
    JSON.stringify(
      {
        ...componentsJsonTemplate,
        style: `${base}-new-york`,
        aliases: { ...componentsJsonTemplate.aliases, ui: `@/components/${base}/ui` },
      },
      null,
      2,
    ) + "\n",
  )
}

function run(args) {
  console.log(`\n$ duz-ui ${args.join(" ")}`)
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: gallery,
    stdio: "inherit",
    env: { ...process.env, DUZ_UI_REGISTRY: registry },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

for (const base of BASES) {
  console.log(`\n=== Installing the ${base} base into app/components/${base}/ui ===`)
  writeComponentsJson(base)
  run(["init", "--yes"])
  // The gallery does not own these files: they are regenerated from the
  // registry on every sync, which is what proves it renders the same source a
  // user receives. `add` refuses to replace differing component files unless
  // ownership is handed over explicitly, so the gallery hands it over.
  const components = uiItems
    .filter((item) => item.bases?.includes(base))
    .map((item) => item.name)
    .sort()
  run(["add", ...components, "--yes", "--overwrite"])
  run(["doctor"])
}

// ---------------------------------------------------------------------------
// Examples — one module per example, loaded on demand
// ---------------------------------------------------------------------------

// The hand-written shared sources live in app/content/examples/<name>.tsx and
// import the radix tree; the radix copy is the rewrite source, exactly as the
// gallery's own chrome stays on radix. For each base the generator emits a
// rewritten copy of every shared source into
// app/content/examples/.generated/<base>/ and one map
// app/content/examples.<base>.generated.ts whose every entry is a dynamic
// import. A hand-written override (app/content/examples/overrides/<base>/)
// wins where one exists, so example resolution happens once, here, and the
// component page just calls the loader for its base and name.
const examplesDir = path.join(gallery, "app/content/examples")
const overridesDir = path.join(examplesDir, "overrides")
const generatedDir = path.join(examplesDir, ".generated")

// The alias the hand-written shared examples import. The generated per-base
// copies rewrite it to each base's own tree.
const EXAMPLES_SOURCE_ALIAS = '"@/components/radix/ui/'

const sharedExamples = readdirSync(examplesDir)
  .filter((file) => file.endsWith(".tsx"))
  .sort()
  .map((file) => file.slice(0, -".tsx".length))

for (const name of sharedExamples) {
  if (!readFileSync(path.join(examplesDir, `${name}.tsx`), "utf8").includes(EXAMPLES_SOURCE_ALIAS)) {
    console.error(`app/content/examples/${name}.tsx no longer imports ${EXAMPLES_SOURCE_ALIAS}; the per-base rewrite has nothing to rewrite.`)
    process.exit(1)
  }
}

// Regenerated from scratch so a renamed or deleted example cannot leave a
// dead module behind that nothing imports but the bundler still ships.
rmSync(generatedDir, { recursive: true, force: true })

for (const base of BASES) {
  const baseGeneratedDir = path.join(generatedDir, base)
  mkdirSync(baseGeneratedDir, { recursive: true })
  for (const name of sharedExamples) {
    const source = readFileSync(path.join(examplesDir, `${name}.tsx`), "utf8")
    const body = source.replaceAll(EXAMPLES_SOURCE_ALIAS, `"@/components/${base}/ui/`)
    const header = `/**
 * Generated by scripts/sync-gallery.mjs from app/content/examples/${name}.tsx —
 * do not edit. Change the source file and re-run \`pnpm sync:gallery\`.
 *
 * Only the import specifiers are rewritten, to this file's base
 * ("${base}") component tree; everything else is byte-identical to the
 * source.
 */

`
    writeFileSync(path.join(baseGeneratedDir, `${name}.tsx`), header + body)
  }
  console.log(`✓ generated  app/content/examples/.generated/${base} (${sharedExamples.length} examples)`)
}

for (const base of BASES) {
  const baseOverridesDir = path.join(overridesDir, base)
  const overrides = existsSync(baseOverridesDir)
    ? readdirSync(baseOverridesDir)
        .filter((file) => file.endsWith(".tsx"))
        .sort()
        .map((file) => file.slice(0, -".tsx".length))
    : []

  // An override naming a component this base does not carry would sit in the
  // map forever, imported by nobody and pointing at nothing.
  const baseComponentNames = new Set(
    uiItems.filter((item) => item.bases?.includes(base)).map((item) => item.name),
  )
  for (const name of overrides) {
    if (!baseComponentNames.has(name)) {
      console.error(`app/content/examples/overrides/${base}/${name}.tsx overrides "${name}", which the ${base} registry does not carry.`)
      process.exit(1)
    }
  }

  const names = [...new Set([...sharedExamples, ...overrides])].sort()
  const entries = names
    .map((name) => {
      const modulePath = overrides.includes(name)
        ? `@/content/examples/overrides/${base}/${name}`
        : `@/content/examples/.generated/${base}/${name}`
      return `  "${name}": () => import("${modulePath}"),`
    })
    .join("\n")
  const map = `/**
 * Generated by scripts/sync-gallery.mjs from app/content/examples and
 * app/content/examples/overrides/${base} — do not edit. Change those sources
 * and re-run \`pnpm sync:gallery\`.
 *
 * One lazy loader per example for the ${base} base. Where a hand-written
 * override exists for this base it wins; every other entry points at the
 * generated copy of the shared source, whose import specifiers were
 * rewritten to this base's component tree. Resolution happened here, in the
 * generator — consumers call the loader and get both the preview and the
 * usage snippet from the one module.
 */

import type { Example } from "@/content/example"

export const EXAMPLES: Record<string, () => Promise<Example>> = {
${entries}
}
`
  writeFileSync(path.join(gallery, `app/content/examples.${base}.generated.ts`), map)
  console.log(`✓ generated  app/content/examples.${base}.generated.ts (${names.length} examples)`)
}
