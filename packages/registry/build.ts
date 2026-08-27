import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
  title: string
  description: string
  dependencies: string[]
  registryDependencies: string[]
  sources: string[]
  agentUi?: { kind?: string; actions?: string[]; status: string }
}

interface Manifest {
  $schema: string
  name: string
  homepage: string
  items: ManifestItem[]
}

/**
 * Derive the shadcn file `type` and the user-project `target` path from a
 * declared source path (relative to `src/`).
 */
function fileMeta(src: string): { type: RegistryFile["type"]; target: string } {
  // A lib source keeps its path: lib/agent-ui/registry.ts and lib/utils.ts
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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

const manifest = readJson<Manifest>(resolve(__dirname, "registry.json"))

mkdirSync(outputDir, { recursive: true })

const indexItems: Array<Record<string, unknown>> = []

for (const item of manifest.items) {
  const files: RegistryFile[] = []

  for (const src of item.sources) {
    const abs = resolve(srcRoot, src)
    if (!existsSync(abs)) {
      console.error(`Source file not found for "${item.name}": ${src}`)
      process.exit(1)
    }
    const content = readFileSync(abs, "utf8")
    const { type, target } = fileMeta(src)
    files.push({ path: src, content, type, target })
  }

  const itemJson: Record<string, unknown> = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
    files,
  }
  if (item.agentUi) {
    itemJson.agentUi = item.agentUi
  }

  writeJson(join(outputDir, `${item.name}.json`), itemJson)
  console.log(`${item.name}  ${files.length} file${files.length === 1 ? "" : "s"}`)

  const indexItem: Record<string, unknown> = {
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
  }
  if (item.agentUi) {
    indexItem.agentUi = item.agentUi
  }
  indexItems.push(indexItem)
}

writeJson(join(outputDir, "registry.json"), {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: manifest.name,
  homepage: manifest.homepage,
  items: indexItems,
})
