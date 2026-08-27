/**
 * Agent UI — project configuration loader.
 *
 * Reads `package.json`, `components.json` (shadcn config) and
 * `tsconfig.json` / `jsconfig.json` to build a `ProjectConfig` that the rest of
 * the CLI uses for alias resolution and file placement.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { aliasToDir } from "./paths.js"

export interface ProjectConfig {
  cwd: string
  tsx: boolean
  aliases: { components: string; ui: string; lib: string; utils: string }
  resolved: { ui: string; lib: string; utils: string }
  packageJsonPath: string
}

export async function loadProject(cwd: string): Promise<ProjectConfig> {
  const packageJsonPath = join(cwd, "package.json")
  if (!existsSync(packageJsonPath)) {
    throw new Error("Agent UI requires a React project.")
  }
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (!("react" in allDeps)) {
    throw new Error("Agent UI requires a React project.")
  }

  // Read shadcn components.json when present.
  const componentsJsonPath = join(cwd, "components.json")
  const componentsJson: { tsx?: boolean; aliases?: Record<string, string> } =
    existsSync(componentsJsonPath)
      ? (JSON.parse(readFileSync(componentsJsonPath, "utf8")) as {
          tsx?: boolean
          aliases?: Record<string, string>
        })
      : {}

  const tsx = componentsJson.tsx !== false
  const aliases = {
    components: componentsJson.aliases?.components ?? "@/components",
    ui: componentsJson.aliases?.ui ?? "@/components/ui",
    lib: componentsJson.aliases?.lib ?? "@/lib",
    utils: componentsJson.aliases?.utils ?? "@/lib/utils",
  }

  const paths = readPaths(cwd)

  const libDir = resolveAliasPath(aliases.lib, paths, cwd)
  const uiDir = resolveAliasPath(aliases.ui, paths, cwd)
  const utilsBase = resolveAliasPath(aliases.utils, paths, cwd)
  const utilsFile = resolveUtilsFile(utilsBase)

  return {
    cwd,
    tsx,
    aliases,
    resolved: { ui: uiDir, lib: libDir, utils: utilsFile },
    packageJsonPath,
  }
}

/**
 * Read `compilerOptions.paths` from `tsconfig.json` then `jsconfig.json`.
 * Real tsconfigs are JSONC: strip `//` line comments (string-aware) and
 * trailing commas before `JSON.parse`.
 */
function readPaths(cwd: string): Record<string, string[]> {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const configPath = join(cwd, name)
    if (!existsSync(configPath)) continue
    const text = readFileSync(configPath, "utf8")
    const config = parseJsonc(text) as {
      compilerOptions?: { paths?: Record<string, string[]> }
    }
    const paths = config.compilerOptions?.paths
    if (paths) return paths
  }
  return {}
}

/**
 * Resolve an alias to an absolute path. When no `paths` mapping matches,
 * fall back to `<cwd>/src` if it exists, otherwise `<cwd>`. This mirrors
 * shadcn's own resolution order.
 */
function resolveAliasPath(
  alias: string,
  paths: Record<string, string[]>,
  cwd: string,
): string {
  const resolved = aliasToDir(alias, paths, cwd)
  if (resolved) return resolved

  const base = existsSync(join(cwd, "src")) ? join(cwd, "src") : cwd
  const stripped = alias.replace(/^@\//, "")
  return join(base, stripped)
}

/**
 * `resolved.utils` is a file path. Append `.ts`/`.tsx` when the alias has no
 * extension, preferring whichever file already exists (defaulting to `.ts`).
 */
function resolveUtilsFile(basePath: string): string {
  if (basePath.endsWith(".ts") || basePath.endsWith(".tsx")) return basePath
  if (existsSync(`${basePath}.ts`)) return `${basePath}.ts`
  if (existsSync(`${basePath}.tsx`)) return `${basePath}.tsx`
  return `${basePath}.ts`
}

/**
 * tsconfig.json is JSONC: it may carry line comments, block comments and
 * trailing commas. The string alternative in the pattern is what keeps a `//`
 * or `/*` inside a path value from being treated as a comment.
 */
function parseJsonc(text: string): unknown {
  const stripped = text
    .replace(
      /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
      (_, str: string | undefined) => str ?? "",
    )
    .replace(/,(\s*[}\]])/g, "$1")
  return JSON.parse(stripped)
}
