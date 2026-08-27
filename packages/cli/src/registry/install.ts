/**
 * Agent UI — registry install logic shared by `init`, `add` and `migrate`.
 *
 * `rewriteAliases` is the single place canonical registry aliases are mapped
 * onto the project's own aliases. `installItems` writes each file to its
 * target path, reporting created / updated / unchanged, and installs the
 * union of the items' npm dependencies.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { ProjectConfig } from "../project/config.js"
import { ensureDependencies } from "../project/deps.js"
import type { RegistryItem } from "./schema.js"

export interface InstallOptions {
  dryRun?: boolean
}

export interface WrittenFile {
  target: string
  status: "created" | "updated" | "unchanged"
}

/**
 * Rewrite canonical registry aliases to the project's own aliases, in import
 * specifiers only. Longest prefix wins so `@/lib/agent-ui/` is matched before
 * `@/lib/utils`.
 */
export function rewriteAliases(content: string, config: ProjectConfig): string {
  const rules: Array<[string, string]> = [
    ["@/lib/agent-ui/", `${config.aliases.lib}/agent-ui/`],
    ["@/components/ui/", `${config.aliases.ui}/`],
    ["@/lib/utils", config.aliases.utils],
  ]

  return content.replace(
    /(from\s+)(["'])([^"']+)\2/g,
    (match, keyword: string, quote: string, specifier: string) => {
      for (const [from, to] of rules) {
        if (specifier.startsWith(from)) {
          return `${keyword}${quote}${to}${specifier.slice(from.length)}${quote}`
        }
      }
      return match
    },
  )
}

export async function installItems(
  config: ProjectConfig,
  items: RegistryItem[],
  options?: InstallOptions,
): Promise<{ files: WrittenFile[]; installedDependencies: string[] }> {
  const dryRun = options?.dryRun ?? false
  const files: WrittenFile[] = []

  for (const item of items) {
    for (const file of item.files) {
      const dest = resolveTarget(file.target, config)
      const content = rewriteAliases(file.content, config)

      let status: WrittenFile["status"]
      if (!existsSync(dest)) {
        status = "created"
        if (!dryRun) {
          mkdirSync(dirname(dest), { recursive: true })
          writeFileSync(dest, content, "utf8")
        }
      } else {
        const existing = readFileSync(dest, "utf8")
        if (existing === content) {
          status = "unchanged"
        } else {
          status = "updated"
          if (!dryRun) {
            writeFileSync(dest, content, "utf8")
          }
        }
      }

      files.push({ target: file.target, status })
    }
  }

  const deps = new Set<string>()
  for (const item of items) {
    for (const dep of item.dependencies) {
      deps.add(dep)
    }
  }

  const installedDependencies = dryRun
    ? []
    : await ensureDependencies(config, [...deps])

  return { files, installedDependencies }
}

/**
 * Resolve a registry `target` (project-relative) to an absolute path.
 * `lib/...` maps under the `lib` alias's directory; `components/ui/...` maps
 * under the `ui` alias's directory.
 */
function resolveTarget(target: string, config: ProjectConfig): string {
  // `utils` has its own alias, which a project may point somewhere other than
  // under `lib`. Writing it anywhere else would contradict the import that
  // rewriteAliases produces.
  if (target === "lib/utils.ts") {
    return config.resolved.utils
  }
  if (target.startsWith("lib/")) {
    return join(config.resolved.lib, target.slice("lib/".length))
  }
  if (target.startsWith("components/ui/")) {
    return join(config.resolved.ui, target.slice("components/ui/".length))
  }
  throw new Error(`Unknown target path: ${target}`)
}
