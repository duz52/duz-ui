/**
 * Agent UI — registry client.
 *
 * Fetches registry documents from an HTTP base URL or a local directory,
 * validates them with zod, and caches parsed items for the process lifetime.
 * `resolve` returns items dependency-first and detects cycles.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { isHttpSource } from "../project/paths.js"
import {
  registryItemSchema,
  registryIndexSchema,
  type RegistryItem,
  type RegistryIndex,
} from "./schema.js"

export interface RegistryClient {
  index(): Promise<RegistryIndex>
  item(name: string): Promise<RegistryItem>
  /** The named items plus their transitive registryDependencies, dependency-first. */
  resolve(names: string[]): Promise<RegistryItem[]>
}

export function defaultRegistrySource(): string {
  return process.env.AGENT_UI_REGISTRY ?? "https://agent-ui.dev/r"
}

export function createRegistryClient(source: string): RegistryClient {
  const cache = new Map<string, RegistryItem>()

  async function readDocument(path: string): Promise<string> {
    if (isHttpSource(source)) {
      const url = `${source}/${path}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Request failed: ${url}`)
      }
      return response.text()
    }
    const filePath = join(source, path)
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    return readFileSync(filePath, "utf8")
  }

  async function item(name: string): Promise<RegistryItem> {
    const cached = cache.get(name)
    if (cached) return cached

    let text: string
    try {
      text = await readDocument(`${name}.json`)
    } catch {
      throw new Error(`Unknown component "${name}"`)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`"${name}" is not valid JSON`)
    }

    const result = registryItemSchema.safeParse(parsed)
    if (!result.success) {
      const issue = result.error.issues[0]
      const location =
        issue && issue.path.length > 0 ? issue.path.join(".") : "document"
      throw new Error(`Registry item "${name}" is invalid at "${location}"`)
    }

    cache.set(name, result.data)
    return result.data
  }

  async function index(): Promise<RegistryIndex> {
    let text: string
    try {
      text = await readDocument("registry.json")
    } catch {
      throw new Error("Could not read the registry index")
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error("Registry index is not valid JSON")
    }

    const result = registryIndexSchema.safeParse(parsed)
    if (!result.success) {
      const issue = result.error.issues[0]
      const location =
        issue && issue.path.length > 0 ? issue.path.join(".") : "document"
      throw new Error(`Registry index is invalid at "${location}"`)
    }

    return result.data
  }

  async function resolve(names: string[]): Promise<RegistryItem[]> {
    const ordered: RegistryItem[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    async function visit(name: string): Promise<void> {
      if (visited.has(name)) return
      if (visiting.has(name)) {
        throw new Error(`Dependency cycle detected at "${name}"`)
      }
      visiting.add(name)
      const resolved = await item(name)
      for (const dep of resolved.registryDependencies) {
        await visit(dep)
      }
      visiting.delete(name)
      visited.add(name)
      ordered.push(resolved)
    }

    for (const name of names) {
      await visit(name)
    }

    return ordered
  }

  return { index, item, resolve }
}
