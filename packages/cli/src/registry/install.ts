/**
 * Agent UI — registry install logic shared by `init`, `add` and `migrate`.
 *
 * `rewriteAliases` is the single place canonical registry aliases are mapped
 * onto the project's own aliases. `installItems` writes each file to its
 * target path, reporting created / updated / unchanged / retained / refused,
 * and installs the union of the items' npm dependencies. Files under
 * `components/ui/` are project-owned once they land: a differing file is left
 * untouched (`refused`) unless `overwrite` is set, in which case it is rewritten
 * (`updated`). The runtime under `lib/agent-ui/` is ours and is always
 * create-or-overwrite. `lib/utils.ts` (see `PROJECT_OWNED_TARGETS`) is created
 * when missing but never rewritten.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { ProjectConfig } from "../project/config.js"
import { ensureDependencies } from "../project/deps.js"
import type { RegistryItem } from "./schema.js"

export interface InstallOptions {
  dryRun?: boolean
  /**
   * When true, a differing `components/ui/` file is rewritten as `updated`.
   * When false (the default), it is left untouched and reported as `refused`.
   */
  overwrite?: boolean
}

export interface WrittenFile {
  /**
   * `created` — the file did not exist and was written.
   * `updated` — the file existed and differed; it was rewritten.
   * `unchanged` — the file existed and was byte-identical.
   * `retained` — a project-owned target (`lib/utils.ts`) that already
   *   existed; never rewritten.
   * `refused` — a project-owned `components/ui/` file that differed and was
   *   left untouched because `overwrite` was not set.
   */
  target: string
  status: "created" | "updated" | "unchanged" | "retained" | "refused"
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

/**
 * Registry `target` values the project owns, not Agent UI. `installItems`
 * creates these when missing but never overwrites an existing one: shadcn
 * projects keep their own helpers next to `cn` in `lib/utils.ts`, and Agent UI
 * only needs `cn` to exist there.
 */
const PROJECT_OWNED_TARGETS = new Set(["lib/utils.ts"])

export async function installItems(
  config: ProjectConfig,
  items: RegistryItem[],
  options?: InstallOptions,
): Promise<{ files: WrittenFile[]; installedDependencies: string[] }> {
  const dryRun = options?.dryRun ?? false
  const overwrite = options?.overwrite ?? false
  const files: WrittenFile[] = []

  for (const item of items) {
    for (const file of item.files) {
      const dest = resolveTarget(file.target, config)
      const exists = existsSync(dest)
      const content = rewriteAliases(file.content, config)

      let status: WrittenFile["status"]
      if (PROJECT_OWNED_TARGETS.has(file.target) && exists) {
        // Project-owned utils: leave an existing file alone.
        status = "retained"
      } else if (!exists) {
        status = "created"
        if (!dryRun) {
          mkdirSync(dirname(dest), { recursive: true })
          writeFileSync(dest, content, "utf8")
        }
      } else {
        const existing = readFileSync(dest, "utf8")
        if (existing === content) {
          status = "unchanged"
        } else if (
          file.target.startsWith("components/ui/") &&
          !overwrite
        ) {
          // Project-owned component: the project owns this file once it
          // lands. Leave it untouched and let the caller decide what to do.
          status = "refused"
        } else {
          // Runtime files (lib/agent-ui/) are ours: overwriting is how they
          // are upgraded. A components/ui/ file reaches here only when the
          // caller passed `overwrite`.
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
