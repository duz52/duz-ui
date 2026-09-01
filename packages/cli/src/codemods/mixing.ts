/**
 * Agent UI — refusal of migrations that would break primitive mixing.
 *
 * A project file that value-imports directly from the primitive package a ui
 * component's implementation uses shares one module instance — and one React
 * context — with it. When migration replaces that component with an
 * implementation importing from a different module of the same primitive, the
 * context moves to the new module instance while the project file's direct
 * import keeps the old one, and the runtime lookup fails: "`X` must be used
 * within `Y`".
 *
 * A file is at risk exactly when it value-imports from a primitive package of
 * the component being replaced, value-imports from the project's own
 * `ui/<component>` module, and the file being replaced value-imports from
 * that package while the replacement does not. Type-only imports and
 * type-only specifiers are erased at compile time, bind no module instance,
 * and never count. The scan covers the project's own source and excludes the
 * ui directory itself — those files are what migration replaces.
 */

import { Project } from "ts-morph"
import type { ProjectConfig } from "../project/config.js"
import {
  displayPath,
  valueImports,
  walkProjectSources,
} from "../project/source-scan.js"
import type { MigrationOutcome } from "./index.js"
import { findSignature } from "./signatures.js"

/** The planning output the refusal pass revises, in the command's own shape. */
interface PlannedResult {
  outcome: MigrationOutcome
  replacement: string
}

/** A direct value import that a replacement would strand on the old module instance. */
interface StrandedImport {
  file: string
  name: string
  packageName: string
}

/**
 * Revise every planned migration whose replacement would strand project files
 * to `unsupported`, with a reason naming each stranded file and the specifier
 * it imports. Returns the refused component names, empty when every migration
 * is safe. Refusing is not overridable: `--overwrite` buys permission to
 * replace an implementation, never to break the files that call it.
 */
export function refuseBreakingMigrations(
  results: PlannedResult[],
  config: ProjectConfig,
): Set<string> {
  const project = new Project({ useInMemoryFileSystem: false })
  const replacementProject = new Project({ useInMemoryFileSystem: true })

  // Primitive packages each replacement drops relative to the file it
  // replaces: packages of the component's signature that the replaced file
  // value-imports and the replacement does not. A package outside the
  // signature's list is not the component's primitive — no context of this
  // component lives in it — so only the list is consulted.
  const dropped = new Map<string, Set<string>>()
  for (const { outcome, replacement } of results) {
    if (outcome.status !== "migrated") continue
    const signature = findSignature(outcome.component)
    if (!signature) continue
    const candidates = new Set(signature.primitiveModules[config.base])
    if (candidates.size === 0) continue
    const current = valueImports(project.addSourceFileAtPath(outcome.file), candidates)
    const next = valueImports(
      replacementProject.createSourceFile(`${outcome.component}.tsx`, replacement),
      candidates,
    )
    const missing = [...current.keys()].filter((pkg) => !next.has(pkg))
    if (missing.length > 0) dropped.set(outcome.component, new Set(missing))
  }
  if (dropped.size === 0) return new Set()

  // One pass over the project's own source: a file is stranded when it
  // value-imports one of the dropped packages and the ui module of the
  // component that package belongs to.
  const uiModules = new Set([...dropped.keys()].map((c) => `${config.aliases.ui}/${c}`))
  const droppedSpecifiers = new Set([...dropped.values()].flatMap((pkgs) => [...pkgs]))
  const stranded = new Map<string, StrandedImport[]>(
    [...dropped.keys()].map((component) => [component, []]),
  )

  const scanFile = (path: string): void => {
    const sourceFile = project.addSourceFileAtPath(path)
    const primitiveImports = valueImports(sourceFile, droppedSpecifiers)
    if (primitiveImports.size === 0) return
    const uiImports = valueImports(sourceFile, uiModules)
    if (uiImports.size === 0) return
    for (const [component, packages] of dropped) {
      if (!uiImports.has(`${config.aliases.ui}/${component}`)) continue
      for (const pkg of packages) {
        const name = primitiveImports.get(pkg)
        if (!name) continue
        stranded.get(component)?.push({ file: path, name, packageName: pkg })
      }
    }
  }

  walkProjectSources(config, scanFile)

  const refused = new Set<string>()
  for (const result of results) {
    if (result.outcome.status !== "migrated") continue
    const { component, file } = result.outcome
    const found = stranded.get(component) ?? []
    if (found.length === 0) continue
    result.outcome = {
      status: "unsupported",
      component,
      file,
      reason: found
        .map(
          (s) =>
            `would break ${displayPath(s.file, config.cwd)},\nwhich imports ${s.name} from ${s.packageName}`,
        )
        .join("\n"),
    }
    refused.add(component)
  }
  return refused
}
