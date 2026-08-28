/**
 * Gallery registry reader.
 *
 * Loads the shadcn-compatible registry JSON emitted by `pnpm build:registry`
 * into `apps/gallery/public/r/` at build time via Vite's `import.meta.glob`.
 * The output is laid out per primitive base: base-independent items sit at the
 * root, base-specific components in a `<base>/` subdirectory. The index file
 * (`registry.json`) is excluded from the public list, and the runtime item
 * (`agent-ui-runtime`) is exposed only through `getItem` for the docs pages.
 *
 * The gallery presents one base at a time (see `DEFAULT_BASE`).
 */

export interface GalleryItem {
  name: string
  /** Primitive base this item is built for; `null` for base-independent items. */
  base: string | null
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

/** Shape of a registry item JSON file, which does not know its own base. */
type RegistryItemFile = Omit<GalleryItem, "base">

/**
 * The base the gallery presents. Which base to show is a product decision
 * that has not been made; until then, default to the base every component
 * currently exists in, so pages are complete rather than empty.
 */
export const DEFAULT_BASE = "radix"

const REGISTRY_ROOT = "../public/r/"
const REGISTRY_INDEX = "registry.json"
const RUNTIME_ITEM = "agent-ui-runtime"

const modules = import.meta.glob("../public/r/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, RegistryItemFile>

function fileName(path: string): string {
  const segments = path.split("/")
  return segments[segments.length - 1] ?? path
}

/** The base directory an item file lives in, or `null` at the registry root. */
function baseOf(path: string): string | null {
  const relative = path.slice(REGISTRY_ROOT.length)
  const separator = relative.indexOf("/")
  return separator === -1 ? null : relative.slice(0, separator)
}

function loadItems(): GalleryItem[] {
  return Object.entries(modules)
    .filter(([path]) => fileName(path) !== REGISTRY_INDEX)
    .map(([path, item]) => ({ ...item, base: baseOf(path) }))
}

/** Whether the item belongs to the base the gallery presents. */
function presented(item: GalleryItem): boolean {
  return item.base === null || item.base === DEFAULT_BASE
}

/**
 * Every presented registry item except the runtime, sorted with agent-native
 * components first and then alphabetically by name.
 */
export function listItems(): GalleryItem[] {
  return loadItems()
    .filter((item) => item.name !== RUNTIME_ITEM && presented(item))
    .sort((a, b) => {
      const aNative = a.agentUi?.status === "agent-native"
      const bNative = b.agentUi?.status === "agent-native"
      if (aNative !== bNative) return aNative ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function getItem(name: string): GalleryItem | undefined {
  return loadItems().find((item) => item.name === name && presented(item))
}
