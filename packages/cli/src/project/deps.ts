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
 * Returns the subset of `deps` not already in the project's `dependencies`
 * or `devDependencies`, installs them with the detected package manager, and
 * returns the list that was installed. A no-op (returns `[]`, spawns nothing)
 * when nothing is missing.
 */
export async function ensureDependencies(
  config: ProjectConfig,
  deps: string[],
): Promise<string[]> {
  const pkg = JSON.parse(readFileSync(config.packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const existing = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
  const missing = deps.filter((d) => !existing.has(d))
  if (missing.length === 0) return []

  const { command, args } = installCommand(detectPackageManager(config.cwd))
  const result = spawnSync(command, [...args, ...missing], {
    stdio: "inherit",
    cwd: config.cwd,
  })
  if (result.status !== 0) {
    // Reporting these as installed would be a lie the next build would expose.
    throw new Error(
      `Could not install dependencies. Install them with: ${command} ${args.join(" ")} ${missing.join(" ")}`,
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
