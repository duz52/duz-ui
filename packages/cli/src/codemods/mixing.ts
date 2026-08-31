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

import { readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { Project, type ImportDeclaration, type SourceFile } from "ts-morph"
import type { ProjectConfig } from "../project/config.js"
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

/** Source extensions the scan reads. Declaration files are types, not runtime. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"])

/**
 * The first name the import binds to a value, or `undefined` when it binds
 * none: a bare side-effect import loads the module but binds nothing, and
 * nothing that binds no value can consume the primitive's React context.
 * Type-only declarations and type-only specifiers are excluded by the caller
 * and here respectively.
 */
function firstValueImport(imp: ImportDeclaration): string | undefined {
  const defaultImport = imp.getDefaultImport()
  if (defaultImport) return defaultImport.getText()
  const namespaceImport = imp.getNamespaceImport()
  if (namespaceImport) return `* as ${namespaceImport.getText()}`
  const named = imp.getNamedImports().find((s) => !s.isTypeOnly())
  return named?.getNameNode().getText()
}

/**
 * The first value-imported name per module specifier, restricted to
 * `specifiers`. A specifier already recorded keeps its first name; a
 * type-only import or one binding no value records nothing, leaving the
 * specifier open for a later import declaration that does bind a value.
 */
function valueImports(
  sourceFile: SourceFile,
  specifiers: ReadonlySet<string>,
): Map<string, string> {
  const found = new Map<string, string>()
  for (const imp of sourceFile.getImportDeclarations()) {
    const specifier = imp.getModuleSpecifierValue()
    if (!specifiers.has(specifier) || imp.isTypeOnly() || found.has(specifier)) continue
    const name = firstValueImport(imp)
    if (name) found.set(specifier, name)
  }
  return found
}

/** The file's path as the project sees it, e.g. `src/components/data-table/view-options.tsx`. */
function displayPath(file: string, cwd: string): string {
  return relative(cwd, file).split(sep).join("/")
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

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      if (entry.name === "node_modules") continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (path !== config.resolved.ui) walk(path)
        continue
      }
      if (entry.name.endsWith(".d.ts")) continue
      const dot = entry.name.lastIndexOf(".")
      if (dot === -1 || !SOURCE_EXTENSIONS.has(entry.name.slice(dot))) continue
      scanFile(path)
    }
  }
  walk(config.cwd)

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
