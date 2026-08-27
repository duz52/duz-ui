/**
 * Agent UI — migration codemod.
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
import { SIGNATURES, type ComponentSignature } from "./signatures.js"

export type MigrationOutcome =
  | { status: "migrated"; component: string; file: string }
  | { status: "already-migrated"; component: string; file: string }
  | { status: "unsupported"; component: string; file: string; reason: string }
  | { status: "presentation"; component: string }
  | { status: "explicit-semantics"; component: string }
  | { status: "unknown"; component: string }

export interface MigrateFileInput {
  /** Absolute path of the file in the user's project. */
  file: string
  /** Component name derived from the file name. */
  component: string
  /** The Agent UI implementation, aliases already rewritten. */
  replacement: string
  /** Alias prefix that identifies an installed Agent UI runtime import. */
  runtimeImportPrefix: string
}

function findSignature(name: string): ComponentSignature | undefined {
  return SIGNATURES.find((s) => s.name === name)
}

/**
 * Decide whether `sourceFile` is unmodified stock shadcn output for the
 * component described by `signature` — a fact about the file alone, with no
 * reference to the replacement. Returns `undefined` when the file is stock, or
 * the reason string when it is not.
 *
 * Checks, in order: every required export is present; exactly one import from
 * an allowed primitive module (when the signature declares one); and every
 * top-level statement is a stock construct (imports, re-exports, allowed
 * function/variable declarations, and prologue string directives).
 */
function recognizeStockSource(
  sourceFile: SourceFile,
  signature: ComponentSignature,
): string | undefined {
  // Required exports must all be present.
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys())
  for (const name of signature.requiredExports) {
    if (!exportedNames.has(name)) {
      return `missing required export "${name}"`
    }
  }

  // Exactly one primitive import when the signature declares one.
  if (signature.primitiveModules.length > 0) {
    const matching = sourceFile
      .getImportDeclarations()
      .filter((imp) =>
        signature.primitiveModules.includes(imp.getModuleSpecifierValue()),
      )
    if (matching.length !== 1) {
      return `expected exactly one import from ${signature.primitiveModules.join(" or ")}, found ${matching.length}`
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
 * Decide whether `replacement` can stand in for `sourceFile` without losing a
 * public name — a fact about the pair, with no reference to whether the file
 * is stock. Returns `undefined` when every export of the file is also exported
 * by the replacement, or the reason string naming the first export the
 * replacement drops. The replacement is parsed in memory.
 */
function replacementIsCompatible(
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
 * Decide what migration should do with a single file. The decision is purely
 * syntactic — no type checking, no tsconfig needed. The file is parsed fresh
 * from disk each call so the outcome always reflects the current bytes.
 *
 * Decision order:
 * 1. Idempotence gate — any runtime import means the file is already migrated.
 *    This runs before a signature is looked up because it is a fact about the
 *    file's history, not about either fact below.
 * 2. Signature lookup — no signature for the component means `unknown`.
 * 3. Recognition (`recognizeStockSource`) — a reason means the file is not
 *    stock shadcn output, so the outcome is `unsupported`.
 * 4. Compatibility (`replacementIsCompatible`) — a reason means the replacement
 *    would drop an export, so the outcome is `unsupported`.
 * 5. `migrated`.
 *
 * Recognition runs before compatibility because recognition failing means the
 * developer changed the file — the more actionable diagnosis — whereas
 * reaching compatibility means the file is stock, so a failure there is a
 * defect in the Agent UI registry item rather than in the user's project.
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

  // 3. Recognition — a reason means the file is not stock shadcn output.
  const recognitionReason = recognizeStockSource(sourceFile, signature)
  if (recognitionReason) {
    return { status: "unsupported", component, file, reason: recognitionReason }
  }

  // 4. Compatibility — a reason means the replacement would drop an export.
  const compatibilityReason = replacementIsCompatible(
    sourceFile,
    input.replacement,
  )
  if (compatibilityReason) {
    return {
      status: "unsupported",
      component,
      file,
      reason: compatibilityReason,
    }
  }

  // 5. The file is stock and the replacement covers it.
  return { status: "migrated", component, file }
}

/**
 * Write the replacement to disk for a `migrated` outcome. Performs no
 * transformation — the replacement was already alias-rewritten by the caller.
 * For every other status this is a no-op, which is what makes migration
 * idempotent: an already-migrated or unsupported file is never rewritten.
 */
export function applyMigration(
  outcome: MigrationOutcome,
  replacement: string,
): void {
  if (outcome.status !== "migrated") return
  writeFileSync(outcome.file, replacement, "utf8")
}
