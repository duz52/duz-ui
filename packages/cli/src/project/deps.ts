/**
 * Agent UI — package manager detection and dependency installation.
 *
 * Detects the workspace's package manager by walking up to the filesystem
 * root for a lockfile, and installs only the dependencies the project does
 * not already declare. This CLI never manages versions.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import type { ProjectConfig } from "./config.js"

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm"

/**
 * Walk up from `cwd` to the filesystem root looking for a lockfile. A
 * workspace package finds its root lockfile this way. Falls back to npm.
 */
export function detectPackageManager(cwd: string): PackageManager {
  let dir = cwd
  while (true) {
    if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm"
    if (existsSync(join(dir, "yarn.lock"))) return "yarn"
    if (existsSync(join(dir, "bun.lockb"))) return "bun"
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return "npm"
}

/**
 * The dependency names the project's package.json declares, across
 * `dependencies` and `devDependencies`.
 */
function declaredDependencies(packageJsonPath: string): Set<string> {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
}

/**
 * Returns the subset of `deps` not already in the project's `dependencies`
 * or `devDependencies`, installs them with the detected package manager, and
 * returns the list that was installed. A no-op (returns `[]`, spawns nothing)
 * when nothing is missing.
 *
 * Whether the install happened is read from package.json after the package
 * manager exits, never from its exit status: pnpm exits non-zero for
 * ERR_PNPM_IGNORED_BUILDS — build scripts awaiting approval — after
 * successfully writing the dependencies. A dependency is installed iff it is
 * now declared; the ones still missing make the command fail.
 */
export async function ensureDependencies(
  config: ProjectConfig,
  deps: string[],
): Promise<string[]> {
  const declared = declaredDependencies(config.packageJsonPath)
  const missing = deps.filter((d) => !declared.has(d))
  if (missing.length === 0) return []

  const { command, args } = installCommand(detectPackageManager(config.cwd))
  const result = spawnSync(command, [...args, ...missing], {
    stdio: "inherit",
    cwd: config.cwd,
  })

  const installed = declaredDependencies(config.packageJsonPath)
  const stillMissing = missing.filter((d) => !installed.has(d))
  if (stillMissing.length > 0) {
    const detail = result.error ? result.error.message : `exit status ${result.status}`
    throw new Error(
      `Could not install dependencies (${detail}). Install them with: ${command} ${args.join(" ")} ${stillMissing.join(" ")}`,
    )
  }
  return missing
}

function installCommand(
  manager: PackageManager,
): { command: string; args: string[] } {
  switch (manager) {
    case "pnpm":
      return { command: "pnpm", args: ["add"] }
    case "yarn":
      return { command: "yarn", args: ["add"] }
    case "bun":
      return { command: "bun", args: ["add"] }
    case "npm":
      return { command: "npm", args: ["install"] }
  }
}
