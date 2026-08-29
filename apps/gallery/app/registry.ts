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
 * Every base is addressable in the URL (`/components/:base/:name`), the way
 * shadcn does it: a component missing from a base simply has no page there,
 * rather than being greyed out or redirected to a default base.
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

/** Human titles for the bases, keyed by registry directory name. */
export const BASE_TITLES: Record<string, string> = {
  base: "Base UI",
  radix: "Radix UI",
}

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

const ITEMS: GalleryItem[] = Object.entries(modules)
  .filter(([path]) => fileName(path) !== REGISTRY_INDEX)
  .map(([path, item]) => ({ ...item, base: baseOf(path) }))

/** Whether the item belongs to `base`; base-independent items belong to all. */
function inBase(item: GalleryItem, base: string): boolean {
  return item.base === null || item.base === base
}

/**
 * Bases present in the registry output, discovered from the `<base>/`
 * directory of each item file — never hardcoded.
 */
export const BASES: string[] = [
  ...new Set(
    ITEMS.flatMap((item) => (item.base === null ? [] : [item.base])),
  ),
].sort()

/**
 * Every registry item in `base` except the runtime, sorted with agent-native
 * components first and then alphabetically by name.
 */
export function listItems(base: string): GalleryItem[] {
  return ITEMS.filter((item) => item.name !== RUNTIME_ITEM && inBase(item, base)).sort(
    (a, b) => {
      const aNative = a.agentUi?.status === "agent-native"
      const bNative = b.agentUi?.status === "agent-native"
      if (aNative !== bNative) return aNative ? -1 : 1
      return a.name.localeCompare(b.name)
    },
  )
}

export function getItem(base: string, name: string): GalleryItem | undefined {
  return ITEMS.find((item) => item.name === name && inBase(item, base))
}

/** The bases whose registry output actually contains this item. */
export function basesFor(name: string): string[] {
  return BASES.filter((base) => ITEMS.some((item) => inBase(item, base) && item.name === name))
}
