/**
 * Gallery registry reader.
 *
 * Loads the shadcn-compatible registry JSON emitted by
 * `pnpm build:registry` into `apps/gallery/public/r/*.json` at build time via
 * Vite's `import.meta.glob`. The index file (`registry.json`) and the runtime
 * item (`agent-ui-runtime`) are excluded from the public list — the runtime is
 * exposed only through `getItem` for the docs pages.
 */

export interface GalleryItem {
  name: string
  title: string
  description: string
  type: string
  dependencies: string[]
  registryDependencies: string[]
  files: { path: string; content: string; target: string }[]
  agentUi?:
    | {
        capabilities: { kind: string; actions: string[] }[]
        status: "agent-native"
      }
    | { status: "presentation" }
    | { status: "explicit-semantics" }
}

const REGISTRY_INDEX = "registry.json"
const RUNTIME_ITEM = "agent-ui-runtime"

const modules = import.meta.glob("../public/r/*.json", {
  eager: true,
  import: "default",
}) as Record<string, GalleryItem>

function baseName(path: string): string {
  const segments = path.split("/")
  return segments[segments.length - 1] ?? path
}

function loadItems(): GalleryItem[] {
  return Object.entries(modules)
    .filter(([path]) => baseName(path) !== REGISTRY_INDEX)
    .map(([, item]) => item)
}

/**
 * Every registry item except the index and the runtime, sorted with
 * agent-native components first and then alphabetically by name.
 */
export function listItems(): GalleryItem[] {
  return loadItems()
    .filter((item) => item.name !== RUNTIME_ITEM)
    .sort((a, b) => {
      const aNative = a.agentUi?.status === "agent-native"
      const bNative = b.agentUi?.status === "agent-native"
      if (aNative !== bNative) return aNative ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function getItem(name: string): GalleryItem | undefined {
  return loadItems().find((item) => item.name === name)
}
