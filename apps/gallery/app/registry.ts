/**
 * Gallery registry reader.
 *
 * The registry is emitted to `public/r/` because that is the product surface:
 * `duz-ui add` fetches it over HTTP from exactly there. Vite refuses to let
 * JavaScript import anything under `public/` — a static import or an
 * `import.meta.glob` of those files fails the dev server outright — so this
 * module reads those files at request time, through the Worker's asset
 * binding.
 *
 * Two requests, two sizes: the index (`registry.json`, no file contents) for
 * navigation, and one item document for the page being rendered. The
 * component page therefore never carries another component's source.
 *
 * The output is laid out per primitive base: base-independent items sit at
 * the registry root, base-specific components in a `<base>/` subdirectory.
 * Every base is addressable in the URL (`/components/:base/:name`), the way
 * shadcn does it: a component missing from a base simply has no page there,
 * rather than being greyed out or redirected to a default base.
 */

import type { RouterContextProvider } from "react-router"

import { cloudflare } from "@/cloudflare"

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
  agentUi?: AgentUiMetadata
}

/** Shape of a registry item JSON file, which does not know its own base. */
type RegistryItemFile = Omit<GalleryItem, "base">

/** Agent-native metadata, identical in the index and the item documents. */
type AgentUiMetadata =
  | {
      capabilities: { kind: string; actions: string[] }[]
      status: "agent-native"
    }
  | { status: "presentation" }

/**
 * Navigation-level entry from `registry.json`: what the sidebar and the base
 * switcher need, with no file contents. `bases` is omitted for
 * base-independent items, whose single document every base carries.
 */
export interface GalleryIndexItem {
  name: string
  type: string
  title: string
  description: string
  bases?: string[]
  agentUi?: AgentUiMetadata
}

/** Human titles for the bases, keyed by registry directory name. */
/**
 * How the component list is grouped, everywhere it is shown — the index, the
 * sidebar and the mobile menu. Ordered to answer the reader's first question:
 * what an agent can operate directly, and what is display-only.
 */
export const STATUS_GROUPS: {
  status: NonNullable<GalleryIndexItem["agentUi"]>["status"]
  label: string
  note: string
}[] = [
  {
    status: "agent-native",
    label: "Agent-native",
    note: "Registers a capability. An agent can read its state and act on it.",
  },
  {
    status: "presentation",
    label: "Presentation",
    note: "No capability. Layout and display only.",
  },
]

export const BASE_TITLES: Record<string, string> = {
  base: "Base UI",
  radix: "Radix UI",
}

const REGISTRY_ROOT = "/r/"

/**
 * Read a registry document from the deployment's own asset store.
 *
 * Through the binding, never over HTTP: this Worker is the origin for every
 * path on its hostname, so a request to its own URL loops back into the
 * Worker instead of reaching the file. The binding reads the asset store
 * directly, and costs no edge round trip.
 */
async function readDocument<T>(
  context: Readonly<RouterContextProvider>,
  request: Request,
  path: string,
): Promise<T | undefined> {
  const { env } = context.get(cloudflare)
  const response = await env.ASSETS.fetch(
    new URL(`${REGISTRY_ROOT}${path}`, request.url),
  )
  if (!response.ok) return undefined
  return (await response.json()) as T
}

/** The index: every item's metadata, without any file contents. */
export async function fetchIndex(
  context: Readonly<RouterContextProvider>,
  request: Request,
): Promise<GalleryIndexItem[]> {
  const index = await readDocument<{ items: GalleryIndexItem[] }>(
    context,
    request,
    "registry.json",
  )
  if (!index) {
    throw new Response("Registry index is unavailable", { status: 500 })
  }
  return index.items
}

/** Bases present in the registry output, discovered from the index. */
export function basesOf(items: GalleryIndexItem[]): string[] {
  return [...new Set(items.flatMap((item) => item.bases ?? []))].sort()
}

/** The bases carrying the item; a base-independent item is carried by all. */
function carriedBy(item: GalleryIndexItem, items: GalleryIndexItem[]): string[] {
  return item.bases ?? basesOf(items)
}

/**
 * The installable components in `base`, sorted with agent-native ones first
 * and then alphabetically by name.
 *
 * Filtered by type, not by name: the registry also carries the runtime, the
 * `utils` lib and the `use-mobile` hook, which arrive as dependencies rather
 * than as things a reader installs or a page documents. Excluding only the
 * runtime by name left those two in the list, where every consumer then
 * dropped them silently because they have no `agentUi` status. `duz-ui add`
 * draws the same line at `registry:ui`.
 */
export function listItems(
  items: GalleryIndexItem[],
  base: string,
): GalleryIndexItem[] {
  return items
    .filter(
      (item) => item.type === "registry:ui" && carriedBy(item, items).includes(base),
    )
    .sort((a, b) => {
      const aNative = a.agentUi?.status === "agent-native"
      const bNative = b.agentUi?.status === "agent-native"
      if (aNative !== bNative) return aNative ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/** The bases whose registry output actually contains this item. */
export function basesFor(items: GalleryIndexItem[], name: string): string[] {
  const item = items.find((candidate) => candidate.name === name)
  return item ? carriedBy(item, items) : []
}

/** One full item document, or undefined when the base does not carry it. */
export async function fetchItem(
  context: Readonly<RouterContextProvider>,
  request: Request,
  items: GalleryIndexItem[],
  base: string,
  name: string,
): Promise<GalleryItem | undefined> {
  const entry = items.find((candidate) => candidate.name === name)
  if (!entry || !carriedBy(entry, items).includes(base)) return undefined
  const path = entry.bases ? `${base}/${name}.json` : `${name}.json`
  const document = await readDocument<RegistryItemFile>(context, request, path)
  if (!document) return undefined
  return { ...document, base: entry.bases ? base : null }
}
