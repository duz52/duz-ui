/**
 * Duz UI — one pass over a project's own source.
 *
 * Two commands need the same question answered about application code: which
 * files value-import a given npm package. `migrate` asks it to refuse a
 * replacement that would strand a direct primitive import; `doctor` asks it to
 * report a library the application draws with directly while the component
 * that would make it agent-readable is not installed.
 *
 * The walk and the import reading live here so both ask it the same way. The
 * ui directory is excluded: those files are ours — migrate replaces them, and
 * a component importing its own primitive is not the application doing it.
 */

import { readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { Project, type ImportDeclaration, type SourceFile } from "ts-morph"

import type { ProjectConfig } from "./config.js"

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
export function valueImports(
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

/**
 * Visit every source file of the project's own code, skipping dotted
 * directories, `node_modules`, declaration files and the ui directory.
 */
export function walkProjectSources(
  config: ProjectConfig,
  visit: (path: string) => void,
): void {
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
      visit(path)
    }
  }
  walk(config.cwd)
}

/**
 * The first project file that value-imports each of `packages`, by package.
 *
 * One walk answers for every package at once, and a package stops being
 * looked for as soon as one file is found: the report names a place to look,
 * not every place.
 */
export function findPackageImporters(
  config: ProjectConfig,
  packages: ReadonlySet<string>,
): Map<string, string> {
  if (packages.size === 0) return new Map()

  const project = new Project({ useInMemoryFileSystem: false })
  const found = new Map<string, string>()

  walkProjectSources(config, (path) => {
    if (found.size === packages.size) return
    const imports = valueImports(project.addSourceFileAtPath(path), packages)
    for (const specifier of imports.keys()) {
      if (!found.has(specifier)) found.set(specifier, path)
    }
  })

  return found
}

/** The file's path as the project sees it, e.g. `src/components/chart/overview.tsx`. */
export function displayPath(file: string, cwd: string): string {
  return relative(cwd, file).split(sep).join("/")
}
