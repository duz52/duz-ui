import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(__dirname, "src")
const outputDir = resolve(__dirname, "..", "..", "apps", "gallery", "public", "r")

/** One emitted registry file: the source, inlined, with its install target. */
interface RegistryFile {
  path: string
  content: string
  type: "registry:lib" | "registry:ui" | "registry:hook"
  target: string
}

interface ManifestItem {
  name: string
  type: string
  /**
   * True when the item's sources resolve against a primitive base tree
   * (`src/bases/<base>/…`) and the item is emitted once per base that
   * provides them. Absent for base-independent items, which are emitted
   * once, at the top level. Which bases carry an item is discovered from
   * disk at build time, never declared here.
   */
  baseSpecific?: boolean
  title: string
  description: string
  /**
   * The item's base-independent npm dependencies, declared once. The npm
   * package each base's source imports its primitive from is not here: it
   * differs per base and is stated by the source itself, so it is derived
   * from the emitted source at build time (`resolveDependencies`).
   */
  dependencies: string[]
  registryDependencies: string[]
  sources: string[]
  agentUi?:
    | { capabilities: { kind: string; actions: string[] }[]; status: "agent-native" }
    | { status: "presentation" }
}

interface Manifest {
  $schema: string
  name: string
  homepage: string
  items: ManifestItem[]
}

/**
 * The primitive bases present on disk, sorted for deterministic output. A
 * base-specific item is emitted for exactly those bases whose tree provides
 * every one of its sources.
 */
function discoverBases(): string[] {
  return readdirSync(join(srcRoot, "bases"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * Derive the shadcn file `type` and the user-project `target` path from a
 * declared source path (relative to `src/`).
 */
function fileMeta(src: string): { type: RegistryFile["type"]; target: string } {
  // A lib source keeps its path: lib/duz-ui/registry.ts and lib/utils.ts
  // land at the same place inside the user's lib alias.
  if (src.startsWith("lib/")) {
    return { type: "registry:lib", target: src }
  }
  if (src.startsWith("ui/")) {
    return { type: "registry:ui", target: `components/ui/${src.slice("ui/".length)}` }
  }
  if (src.startsWith("hooks/")) {
    return { type: "registry:hook", target: src }
  }
  throw new Error(`Unrecognized source path: ${src}`)
}

/**
 * Read one declared source. A base-specific read resolves against the named
 * base tree (`src/bases/<base>/<src>`); a base-independent read resolves as
 * declared against `src/`.
 */
function readSourceFile(itemName: string, src: string, base?: string): RegistryFile {
  const location = base ? `bases/${base}/${src}` : src
  const abs = resolve(srcRoot, location)
  if (!existsSync(abs)) {
    console.error(`Source file not found for "${itemName}": ${location}`)
    process.exit(1)
  }
  return { path: src, content: readFileSync(abs, "utf8"), ...fileMeta(src) }
}

/**
 * Framework peers every consumer project already provides. Sources import
 * them, but they are never registry dependencies.
 */
const FRAMEWORK_PEERS = new Set(["react", "react-dom"])

/**
 * Module specifiers a source imports.
 *
 * A statement always begins a line and always ends in its quoted specifier, so
 * the scan is anchored to a line-leading `import`/`export`. Scanning the whole
 * text for `from "…"` instead would read prose as code: a comment saying an
 * absent field can be told `"empty" from "absent"` produced a dependency on a
 * package named `absent`, and the registry shipped it.
 */
function importedSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(
    /^(?:import|export)\b[\s\S]*?\bfrom\s*"([^"]+)"/gm,
  )) {
    specifiers.push(match[1])
  }
  // A side-effect import carries its specifier with no `from` clause.
  for (const match of source.matchAll(/^import\s+"([^"]+)"/gm)) {
    specifiers.push(match[1])
  }
  return specifiers
}

/**
 * The npm packages a variant's sources import, resolved from bare specifiers:
 * `@scope/pkg/sub` resolves to `@scope/pkg`, `pkg/sub` to `pkg`. Aliased
 * (`@/…`) and relative specifiers are project-internal and become registry
 * dependencies instead.
 */
function importedPackages(files: RegistryFile[]): Set<string> {
  const packages = new Set<string>()
  for (const file of files) {
    for (const spec of importedSpecifiers(file.content)) {
      if (spec.startsWith("@/") || spec.startsWith(".")) continue
      packages.add(
        spec.startsWith("@")
          ? spec.split("/").slice(0, 2).join("/")
          : spec.split("/")[0],
      )
    }
  }
  return packages
}

/**
 * The dependencies an emitted item ships: the manifest's base-independent
 * list, plus the primitive packages the variant's own sources import. The
 * package a component wraps differs per base and is stated by that base's
 * source, so it is derived from the source — declaring it once would give
 * every base the first base's package.
 */
function resolveDependencies(itemName: string, declared: string[], files: RegistryFile[]): string[] {
  const imported = importedPackages(files)
  for (const dep of declared) {
    if (!imported.has(dep)) {
      console.error(`Item "${itemName}" declares dependency "${dep}", which none of its sources import`)
      process.exit(1)
    }
  }
  const derived = [...imported].filter(
    (pkg) => !declared.includes(pkg) && !FRAMEWORK_PEERS.has(pkg),
  )
  return [...declared, ...derived]
}

/**
 * The emitted registry-item document: metadata plus the inlined files. File
 * targets are base-independent — the base decides which source is shipped,
 * never where it lands.
 */
function buildItemJson(
  item: ManifestItem,
  dependencies: string[],
  files: RegistryFile[],
): Record<string, unknown> {
  const itemJson: Record<string, unknown> = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies,
    registryDependencies: item.registryDependencies,
    files,
  }
  if (item.agentUi) {
    itemJson.agentUi = item.agentUi
  }
  return itemJson
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

const manifest = readJson<Manifest>(resolve(__dirname, "registry.json"))

// Emitted from scratch so a renamed or removed item cannot leave a document
// behind that nothing points at but the CLI is still served on request.
rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

const indexItems: Array<Record<string, unknown>> = []
const bases = discoverBases()

for (const item of manifest.items) {
  const indexItem: Record<string, unknown> = {
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    // The declared list, which the manifest states once and is therefore
    // base-independent by construction. What differs per base is the primitive
    // a variant's own source imports, derived in `resolveDependencies`; that
    // resolved list stays in the per-base item document, which remains
    // authoritative for installing. Withholding the declared list from
    // base-specific items left the index unable to answer which package a
    // component exists to wrap — the question `doctor` asks to notice a
    // library an application draws with directly.
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
  }

  if (item.baseSpecific) {
    // Emit once per base whose tree provides every source of the item; a
    // base without the files simply does not carry it.
    const availableBases = bases.filter((base) =>
      item.sources.every((src) => existsSync(resolve(srcRoot, "bases", base, src))),
    )
    if (availableBases.length === 0) {
      console.error(`No base provides the sources of "${item.name}"`)
      process.exit(1)
    }
    for (const base of availableBases) {
      const files = item.sources.map((src) => readSourceFile(item.name, src, base))
      const dependencies = resolveDependencies(item.name, item.dependencies, files)
      mkdirSync(join(outputDir, base), { recursive: true })
      writeJson(join(outputDir, base, `${item.name}.json`), buildItemJson(item, dependencies, files))
      console.log(`${base}/${item.name}  ${files.length} file${files.length === 1 ? "" : "s"}`)
    }
    // Discovered here, not declared in the manifest, so the index is the one
    // place a client can see what exists per base.
    indexItem.bases = availableBases
  } else {
    const files = item.sources.map((src) => readSourceFile(item.name, src))
    const dependencies = resolveDependencies(item.name, item.dependencies, files)
    writeJson(join(outputDir, `${item.name}.json`), buildItemJson(item, dependencies, files))
    console.log(`${item.name}  ${files.length} file${files.length === 1 ? "" : "s"}`)
  }

  if (item.agentUi) {
    indexItem.agentUi = item.agentUi
  }
  indexItems.push(indexItem)
}

/**
 * Every kernel source must be shipped by some item.
 *
 * The runtime item lists its sources by hand, so a new kernel file is invisible
 * until someone remembers to add it: the registry builds, the tests pass, and
 * only a consuming app fails to resolve the import. The manifest stays the
 * declaration — this only refuses to build a registry that would ship a broken
 * runtime.
 */
const shippedSources = new Set(manifest.items.flatMap((item) => item.sources))
const kernelDir = join(srcRoot, "lib", "duz-ui")
const unshipped = readdirSync(kernelDir)
  .map((file) => `lib/duz-ui/${file}`)
  .filter((src) => !shippedSources.has(src))
if (unshipped.length > 0) {
  console.error(
    `No registry item ships ${unshipped.join(", ")}. Add them to the sources of "duz-ui-runtime".`,
  )
  process.exit(1)
}

writeJson(join(outputDir, "registry.json"), {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: manifest.name,
  homepage: manifest.homepage,
  items: indexItems,
})
