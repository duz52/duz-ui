/**
 * Duz UI — pure path helpers.
 *
 * No I/O. These are the building blocks `config.ts` and `install.ts` use to
 * turn aliases and registry targets into absolute filesystem paths.
 */

import { resolve, join } from "node:path"

/**
 * Resolve an alias like `"@/components/ui"` to an absolute directory by
 * matching it against the longest `paths` key whose prefix (with a trailing
 * `/*` stripped) is a prefix of the alias, then joining the remainder onto the
 * mapped directory (also `/*`-stripped) resolved against `cwd`.
 *
 * Example: alias `"@/components/ui"` with paths `{ "@/*": ["./app/*"] }` and
 * cwd `"/proj"` → `"/proj/app/components/ui"`.
 *
 * Returns `undefined` when no paths key matches.
 */
export function aliasToDir(
  alias: string,
  paths: Record<string, string[]>,
  cwd: string,
): string | undefined {
  // Sort keys by length descending so the most specific prefix is tried first.
  const keys = Object.keys(paths).sort((a, b) => b.length - a.length)

  for (const key of keys) {
    const prefix = key.endsWith("/*") ? key.slice(0, -2) : key
    if (alias === prefix || alias.startsWith(`${prefix}/`)) {
      const remainder = alias.slice(prefix.length).replace(/^\//, "")
      const mappings = paths[key]
      if (!mappings || mappings.length === 0) continue
      const mapped = mappings[0]
      if (!mapped) continue
      const dir = mapped.endsWith("/*") ? mapped.slice(0, -2) : mapped
      return resolve(cwd, join(dir, remainder))
    }
  }

  return undefined
}

/** True when `source` is an `http://` or `https://` URL. */
export function isHttpSource(source: string): boolean {
  return source.startsWith("http://") || source.startsWith("https://")
}
