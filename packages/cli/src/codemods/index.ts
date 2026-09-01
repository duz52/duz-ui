/**
 * Duz UI — migration codemod.
 *
 * Migration is structural recognition followed by canonical replacement.
 * The codemod owns ONLY source transformation. It never defines capability
 * semantics, identity, WebMCP schemas or dispatch — those already live in the
 * registry source it installs.
 *
 * Idempotence is structural: an already-migrated file is recognised by its
 * runtime import prefix and skipped, so running migrate twice produces no
 * change and cannot layer a second mechanism on top of the first.
 */

import { Project, SyntaxKind, type SourceFile } from "ts-morph"
import { writeFileSync } from "node:fs"
import { findSignature, type ComponentSignature } from "./signatures.js"
import { fingerprintSource } from "./fingerprint.js"
import { STOCK_FINGERPRINTS } from "./stock-fingerprints.js"
import type { ProjectConfig } from "../project/config.js"
import type { RegistryBase } from "../registry/client.js"
import { canonicaliseAliases } from "../registry/install.js"

export type MigrationOutcome =
  | { status: "migrated"; component: string; file: string }
  | { status: "needs-overwrite"; component: string; file: string }
  | { status: "already-migrated"; component: string; file: string }
  | { status: "unsupported"; component: string; file: string; reason: string }
  | { status: "presentation"; component: string }
  | { status: "unknown"; component: string }

export interface MigrateFileInput {
  /** Absolute path of the file in the user's project. */
  file: string
  /** Component name derived from the file name. */
  component: string
  /** The Duz UI implementation, aliases already rewritten. */
  replacement: string
  /** Alias prefix that identifies an installed Duz UI runtime import. */
  runtimeImportPrefix: string
  /**
   * Permission to replace a supported but customised implementation. Defaults
   * to false, which leaves the file untouched and reports `needs-overwrite`.
   */
  overwrite?: boolean
  /**
   * Project config carrying the file's aliases. An alias is project
   * configuration, not evidence of modification: `matchesKnownStock`
   * canonicalises the file's import specifiers back to the registry's before
   * fingerprinting, so a stock file in a project with non-default aliases
   * still matches its stock fingerprint.
   */
  config: ProjectConfig
}

/**
 * Is this a shadcn component family we support? Returns `undefined` when the
 * file has every required export, at least one import of a primitive module
 * (when the signature declares any for the project's base) and only stock
 * top-level declarations, or the reason string when it does not. A fact about
 * the file alone, with no reference to the replacement.
 */
function recognizeCandidate(
  sourceFile: SourceFile,
  signature: ComponentSignature,
  base: RegistryBase,
): string | undefined {
  // Required exports must all be present.
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys())
  for (const name of signature.requiredExports) {
    if (!exportedNames.has(name)) {
      return `missing required export "${name}"`
    }
  }

  // At least one primitive import when the base declares specifiers. A Base
  // UI stock file may import several of the listed subpaths (radio-group
  // imports both `radio-group` and `radio`), so the count is not pinned to
  // exactly one; zero is still a failure.
  const primitiveModules = signature.primitiveModules[base]
  if (primitiveModules.length > 0) {
    const matching = sourceFile
      .getImportDeclarations()
      .filter((imp) => primitiveModules.includes(imp.getModuleSpecifierValue()))
    if (matching.length === 0) {
      return `expected an import from ${primitiveModules.join(" or ")}, found 0`
    }
  }

  // Every top-level statement must be a stock construct.
  const allowed = new Set([
    ...signature.requiredExports,
    ...signature.internalDeclarations,
  ])
  for (const statement of sourceFile.getStatements()) {
    // Import declarations are always allowed.
    if (statement.getKind() === SyntaxKind.ImportDeclaration) continue
    // Export declarations (e.g. `export { Tabs, ... }`) are always allowed.
    if (statement.getKind() === SyntaxKind.ExportDeclaration) continue

    // Function declarations must be in the allowed set.
    const fn = statement.asKind(SyntaxKind.FunctionDeclaration)
    if (fn) {
      const name = fn.getName()
      if (name && allowed.has(name)) continue
      return `unexpected top-level declaration "${name ?? "(anonymous)"}"`
    }

    // Type aliases and interfaces are name-checked like functions: an added type is evidence the file was modified.
    const typeDecl =
      statement.asKind(SyntaxKind.TypeAliasDeclaration) ??
      statement.asKind(SyntaxKind.InterfaceDeclaration)
    if (typeDecl) {
      const name = typeDecl.getName()
      if (allowed.has(name)) continue
      return `unexpected top-level declaration "${name}"`
    }

    // Variable statements must declare only allowed names.
    const vs = statement.asKind(SyntaxKind.VariableStatement)
    if (vs) {
      const names = vs
        .getDeclarationList()
        .getDeclarations()
        .map((d) => d.getName())
      for (const name of names) {
        if (!allowed.has(name)) {
          return `unexpected top-level declaration "${name}"`
        }
      }
      continue
    }

    // Prologue directives such as "use client" are allowed.
    const es = statement.asKind(SyntaxKind.ExpressionStatement)
    if (es && es.getExpression().getKind() === SyntaxKind.StringLiteral) continue

    return `unexpected top-level ${statement.getKindName()}`
  }

  return undefined
}

/**
 * Does the public contract survive the swap? Returns `undefined` when every
 * export of the file is also exported by the replacement, or the reason
 * string naming the first export the replacement drops. A fact about the
 * pair, with no reference to whether the file is stock. The replacement is
 * parsed in memory.
 */
function replacementPreservesExports(
  sourceFile: SourceFile,
  replacement: string,
): string | undefined {
  const replacementProject = new Project({ useInMemoryFileSystem: true })
  const replacementFile = replacementProject.createSourceFile(
    "replacement.tsx",
    replacement,
  )
  const replacementExports = new Set(
    replacementFile.getExportedDeclarations().keys(),
  )
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys())
  for (const name of exportedNames) {
    if (!replacementExports.has(name)) {
      return `replacing would remove the export "${name}"`
    }
  }
  return undefined
}

/**
 * Do we know this exact source? Returns `true` when the fingerprint of the
 * file's text — canonicalised to the registry's aliases — is among the stock
 * fingerprints recorded for `component`. A component with no recorded
 * fingerprints is not known stock, so the answer is `false`.
 *
 * Only the fingerprint uses the canonical form. `recognizeCandidate` and
 * `replacementPreservesExports` keep reading the file as written — they
 * check exports and the primitive package, neither of which is alias-shaped.
 */
function matchesKnownStock(
  sourceFile: SourceFile,
  component: string,
  config: ProjectConfig,
): boolean {
  // Fingerprints are per base: no entry for this component on this base means
  // we do not know this exact source, which is the needs-overwrite path.
  const known = STOCK_FINGERPRINTS[config.base]?.[component]
  if (!known) return false
  // An alias is project configuration, not evidence that a file was modified.
  // Canonicalise the project's aliases back to the registry's before
  // fingerprinting, so a stock file in a project with non-default aliases
  // still matches its stock fingerprint.
  const text = canonicaliseAliases(sourceFile.getFullText(), config)
  return known.includes(fingerprintSource(text))
}

/**
 * Decide what migration should do with a single file. The decision is purely
 * syntactic — no type checking, no tsconfig needed. The file is parsed fresh
 * from disk each call so the outcome always reflects the current bytes.
 *
 * Decision order:
 * 1. Idempotence gate — any runtime import means the file is already migrated.
 *    This runs before a signature is looked up because it is a fact about the
 *    file's history, not about either fact below.
 * 2. Signature lookup — no signature for the component means `unknown`.
 * 3. `recognizeCandidate` — a reason means the file is not a shadcn component
 *    family we support, so the outcome is `unsupported`.
 * 4. `replacementPreservesExports` — a reason means the replacement would drop
 *    an export, so the outcome is `unsupported`. This step sits before step 5
 *    deliberately: the flag can never buy an API break.
 * 5. `matchesKnownStock` — the file's import specifiers are canonicalised
 *    back to the registry's aliases (an alias is configuration, not drift),
 *    then fingerprinted; a match means the file is unmodified stock, so the
 *    outcome is `migrated`.
 * 6. Otherwise the file is a supported family with a customised implementation:
 *    `overwrite` true replaces it (`migrated`), false leaves it
 *    (`needs-overwrite`).
 */
export function planMigration(input: MigrateFileInput): MigrationOutcome {
  const { file, component, runtimeImportPrefix } = input

  const project = new Project({ useInMemoryFileSystem: false })
  let sourceFile
  try {
    // addSourceFileAtPath is idempotent: it returns the existing file if
    // already added. A fresh Project is created per call, so there is no
    // prior registration to clash with.
    sourceFile = project.addSourceFileAtPath(file)
  } catch {
    return {
      status: "unsupported",
      component,
      file,
      reason: "file could not be parsed as TypeScript",
    }
  }

  // 1. Idempotence gate: any runtime import means this was already migrated.
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue().startsWith(runtimeImportPrefix)) {
      return { status: "already-migrated", component, file }
    }
  }

  // 2. No signature for the component means we cannot recognise it.
  const signature = findSignature(component)
  if (!signature) {
    return { status: "unknown", component }
  }

  // 3. Candidate recognition — a reason means the file is not a supported
  //    shadcn component family.
  const candidateReason = recognizeCandidate(sourceFile, signature, input.config.base)
  if (candidateReason) {
    return { status: "unsupported", component, file, reason: candidateReason }
  }

  // 4. Export preservation — a reason means the replacement would drop an
  //    export. `--overwrite` is permission to replace an implementation, never
  //    permission to break the project's public API, so an export that the
  //    replacement would remove is refused no matter what the flag says.
  const exportReason = replacementPreservesExports(sourceFile, input.replacement)
  if (exportReason) {
    return { status: "unsupported", component, file, reason: exportReason }
  }

  // 5. Known stock source — the file is unmodified shadcn output, so replace it.
  if (matchesKnownStock(sourceFile, component, input.config)) {
    return { status: "migrated", component, file }
  }

  // 6. Supported family with a customised implementation. `overwrite` grants
  //    permission to replace the implementation; without it the file is left
  //    for the user to decide.
  if (input.overwrite) {
    return { status: "migrated", component, file }
  }
  return { status: "needs-overwrite", component, file }
}

/**
 * Write the replacement to disk for a `migrated` outcome. Performs no
 * transformation — the replacement was already alias-rewritten by the caller.
 * For every other status this is a no-op, which is what makes migration
 * idempotent: an already-migrated, needs-overwrite or unsupported file is
 * never rewritten.
 */
export function applyMigration(
  outcome: MigrationOutcome,
  replacement: string,
): void {
  if (outcome.status !== "migrated") return
  writeFileSync(outcome.file, replacement, "utf8")
}
