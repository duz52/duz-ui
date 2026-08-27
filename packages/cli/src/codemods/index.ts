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

import { Project, SyntaxKind } from "ts-morph"
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
 * Decide what migration should do with a single file. The decision is purely
 * syntactic — no type checking, no tsconfig needed. The file is parsed fresh
 * from disk each call so the outcome always reflects the current bytes.
 *
 * Decision order:
 * 1. Idempotence gate — any runtime import means the file is already migrated.
 * 2. Required exports — every signature export must be present.
 * 3. Primitive import — exactly one import from the declared primitive module.
 * 4. Top-level statements — only imports, exports, and declarations whose
 *    names are in `requiredExports ∪ internalDeclarations` are allowed.
 *    Anything else means the developer changed the file locally.
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

  const signature = findSignature(component)
  if (!signature) {
    return { status: "unknown", component }
  }

  // 2. Required exports must all be present.
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys())
  for (const name of signature.requiredExports) {
    if (!exportedNames.has(name)) {
      return {
        status: "unsupported",
        component,
        file,
        reason: `missing required export "${name}"`,
      }
    }
  }

  // 3. Exactly one primitive import when the signature declares one.
  if (signature.primitiveModules.length > 0) {
    const matching = sourceFile
      .getImportDeclarations()
      .filter((imp) =>
        signature.primitiveModules.includes(imp.getModuleSpecifierValue()),
      )
    if (matching.length !== 1) {
      return {
        status: "unsupported",
        component,
        file,
        reason: `expected exactly one import from ${signature.primitiveModules.join(" or ")}, found ${matching.length}`,
      }
    }
  }

  // 4. Every top-level statement must be a stock construct.
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
      return {
        status: "unsupported",
        component,
        file,
        reason: `unexpected top-level declaration "${name ?? "(anonymous)"}"`,
      }
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
          return {
            status: "unsupported",
            component,
            file,
            reason: `unexpected top-level declaration "${name}"`,
          }
        }
      }
      continue
    }

    // Prologue directives such as "use client" are allowed.
    const es = statement.asKind(SyntaxKind.ExpressionStatement)
    if (es && es.getExpression().getKind() === SyntaxKind.StringLiteral) continue

    return {
      status: "unsupported",
      component,
      file,
      reason: `unexpected top-level ${statement.getKindName()}`,
    }
  }

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
