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
import {
  Node,
  Project,
  SyntaxKind,
  type ImportDeclaration,
  type JsxElement,
  type SourceFile,
} from "ts-morph"

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

/** One element whose agent identity is derived from text that can change. */
export interface UnstableIdentity {
  /** The JSX tag as written, e.g. `Button`. */
  tag: string
  file: string
  line: number
}

/** Attributes that give an element an identity of its own. */
const IDENTITY_ATTRIBUTES = new Set(["id", "name", "agent"])

/**
 * Whether the element states its own identity, or might through a spread.
 *
 * A spread is counted as stating one. `{...props}` can carry an `id` and this
 * pass cannot see inside it, and a report the developer has to disprove is
 * worse than one finding fewer things.
 */
function statesIdentity(element: JsxElement): boolean {
  for (const attribute of element.getOpeningElement().getAttributes()) {
    if (Node.isJsxSpreadAttribute(attribute)) return true
    if (IDENTITY_ATTRIBUTES.has(attribute.getNameNode().getText())) return true
  }
  return false
}

/**
 * Whether the element's own text is assembled from an expression.
 *
 * `<Button>Run</Button>` names itself the same way for ever. `<Button>{busy ?
 * "Stop" : "Run"}</Button>` renames itself when it is pressed, and so does
 * `<CollapsibleTrigger>Status {count}</CollapsibleTrigger>`. A `{" "}` and the
 * like are formatting, not a name, so a string-literal expression is not one.
 */
function namedByExpression(element: JsxElement): boolean {
  return element.getJsxChildren().some((child) => {
    if (!Node.isJsxExpression(child)) return false
    const expression = child.getExpression()
    return expression !== undefined && !Node.isStringLiteral(expression)
  })
}

/**
 * The components in an installed source file that register a capability.
 *
 * A component module exports far more than its capability: `command.tsx`
 * ships `CommandList`, `CommandGroup` and `CommandSeparator` beside
 * `CommandItem`, and only the last of them is addressable at all. Taking the
 * module as the unit reported every one of them — noise a developer has to
 * disprove — so the set is read from the installed source instead: a function
 * whose body calls `useCapability`.
 *
 * A component registering through a helper rather than directly is missed.
 * That is the intended direction of error: a finding fewer, never a finding
 * the developer has to argue with.
 */
export function capabilityComponents(file: string): Set<string> {
  const sourceFile = new Project({ useInMemoryFileSystem: false }).addSourceFileAtPath(
    file,
  )
  const registering = new Set<string>()
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName()
    if (name === undefined) continue
    const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression)
    if (calls.some((call) => call.getExpression().getText().startsWith("useCapability"))) {
      registering.add(name)
    }
  }
  return registering
}

/**
 * Agent-native elements whose id would be derived from text that changes.
 *
 * With no `id`, `name` or `agent` prop, an element is addressed by its
 * accessible name — which holds for exactly as long as that name does. A
 * control beside a `<Label>Email</Label>` is therefore never reported: that
 * label reads "Email" for ever. One whose text is an expression is, because
 * that is the case measured to strand an agent: a button reading "Run" becomes
 * `button.run`, and pressing it makes the element `button.stop` on its next
 * mount while the agent still holds the old id.
 *
 * Structural throughout: which components are agent-native comes from the
 * caller, which names they are imported under comes from the import, and
 * whether the text can change comes from the syntax. Nothing is guessed from
 * what the text says.
 */
export function unstableIdentities(
  config: ProjectConfig,
  capabilityTags: ReadonlySet<string>,
): UnstableIdentity[] {
  if (capabilityTags.size === 0) return []

  const project = new Project({ useInMemoryFileSystem: false })
  const found: UnstableIdentity[] = []
  const uiPrefix = `${config.aliases.ui}/`

  walkProjectSources(config, (path) => {
    const sourceFile = project.addSourceFileAtPath(path)

    // The capability-registering names this file imported from the ui
    // directory. Reading the import rather than matching tag names keeps a
    // local `Button` of the application's own out of the report.
    const tags = new Set<string>()
    for (const imp of sourceFile.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue()
      if (imp.isTypeOnly() || !specifier.startsWith(uiPrefix)) continue
      for (const named of imp.getNamedImports()) {
        const tag = named.getNameNode().getText()
        if (!named.isTypeOnly() && capabilityTags.has(tag)) tags.add(tag)
      }
    }
    if (tags.size === 0) return

    for (const element of sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement)) {
      const tag = element.getOpeningElement().getTagNameNode().getText()
      if (!tags.has(tag)) continue
      if (statesIdentity(element) || !namedByExpression(element)) continue
      found.push({
        tag,
        file: displayPath(path, config.cwd),
        line: element.getStartLineNumber(),
      })
    }
  })

  return found
}
