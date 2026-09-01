/**
 * Duz UI — CLI entry point.
 *
 * The single developer-facing tooling surface. It orchestrates the commands; it
 * owns no runtime behaviour and no capability semantics.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { Command } from "commander"

import { addCommand } from "./commands/add.js"
import { doctorCommand } from "./commands/doctor.js"
import { initCommand } from "./commands/init.js"
import { migrateCommand } from "./commands/migrate.js"
import { defaultRegistrySource } from "./registry/client.js"
import { error } from "./ui/log.js"

// The built file lives in dist/, so package.json is one level up from it.
const packageJson = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
) as { version: string }

interface GlobalOptions {
  cwd: string
  registry?: string
}

/**
 * Runs a command and turns any failure into one neutral line. The cause only
 * reaches the terminal when DUZ_UI_DEBUG is set, which `log.error` handles.
 */
function guard<Args extends unknown[]>(
  run: (...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    try {
      await run(...args)
    } catch (cause) {
      error(cause instanceof Error ? cause.message : "The command failed.", cause)
      process.exitCode = 1
    }
  }
}

const program = new Command()

program
  .name("duz-ui")
  .description("React components that ship with native agent semantics.")
  .version(packageJson.version)
  .option("--cwd <dir>", "directory to operate in", process.cwd())
  .option("--registry <source>", "registry URL or directory", defaultRegistrySource())

/** Commands never prompt, so --yes exists only so scripts can pass it. */
const YES = ["--yes", "accepted and ignored: no command prompts"] as const

function globals(): GlobalOptions {
  return program.opts<GlobalOptions>()
}

program
  .command("init")
  .description("Install the Duz UI runtime and WebMCP adapter.")
  .option("--dry-run", "print the plan without writing anything")
  .option(...YES)
  .action(
    guard(async (options: { dryRun?: boolean }) => {
      const { cwd, registry } = globals()
      await initCommand({ cwd, registry, dryRun: options.dryRun })
    }),
  )

program
  .command("add")
  .argument("<components...>", "components to install, e.g. data-table")
  .description("Install agent-native components.")
  .option("--dry-run", "print the plan without writing anything")
  .option("--overwrite", "overwrite project-owned component files that differ")
  .option(...YES)
  .action(
    guard(
      async (
        components: string[],
        options: { dryRun?: boolean; overwrite?: boolean },
      ) => {
        const { cwd, registry } = globals()
        await addCommand(components, {
          cwd,
          registry,
          dryRun: options.dryRun,
          overwrite: options.overwrite,
        })
      },
    ),
  )

program
  .command("migrate")
  .description("Upgrade supported shadcn components in place.")
  .argument("[components...]", "components to migrate; omit to migrate every supported component")
  .option("--dry-run", "print the plan without writing anything")
  .option("--overwrite", "replace recognised components whose source differs from known stock")
  .option(...YES)
  .action(
    guard(
      async (
        components: string[],
        options: { dryRun?: boolean; overwrite?: boolean },
      ) => {
        const { cwd, registry } = globals()
        await migrateCommand({
          cwd,
          registry,
          dryRun: options.dryRun,
          overwrite: options.overwrite,
          components,
        })
      },
    ),
  )

program
  .command("doctor")
  .description("Report Duz UI integration status. Repairs nothing.")
  .option(...YES)
  .action(
    guard(async () => {
      const { cwd, registry } = globals()
      await doctorCommand({ cwd, registry })
    }),
  )

await program.parseAsync(process.argv)
