/**
 * Agent UI — source fingerprinting primitive.
 *
 * `fingerprintSource` produces a structural fingerprint of TSX source: the
 * SHA-256 of a token stream built by walking every descendant of the parsed
 * syntax tree in order. Each node contributes one token:
 *
 * - A string literal or a no-substitution template emits its kind name and the
 *   JSON stringification of its literal value.
 * - An identifier or a numeric literal emits its kind name and its text.
 * - JSX text emits its kind name and the JSON stringification of its trimmed
 *   text; a node whose trimmed text is empty contributes no token.
 * - Every other node emits its kind name alone.
 *
 * The tokens are joined with `|` and hashed with SHA-256.
 *
 * Verified properties:
 * - Quote style, semicolons, indentation and comments do not change the
 *   fingerprint.
 * - A changed Tailwind class string changes it.
 * - An added statement in a function body changes it.
 * - An added top-level declaration or export changes it.
 *
 * Literal values are used rather than source text so that the delimiter cannot
 * change the fingerprint: `"use client"` and `'use client'` carry the same
 * literal value, so swapping the quote character leaves the token — and the
 * fingerprint — unchanged. (A string literal and a no-substitution template
 * remain distinct syntax kinds, so converting between them still changes the
 * fingerprint; only the delimiter within a kind is normalised.)
 *
 * This module is a standalone primitive. It must not import from
 * `signatures.ts` or `index.ts`; nothing here depends on the migration
 * codemod's concept of a component.
 */

import { Project, SyntaxKind, type Node } from "ts-morph"
import { createHash } from "node:crypto"

/**
 * Compute a structural fingerprint of TSX source. Stable across cosmetic
 * changes (quote style, semicolons, indentation, comments) and sensitive to
 * any structural change (a changed class string, an added statement, an added
 * declaration). See the module doc for the full specification.
 */
export function fingerprintSource(source: string): string {
  const project = new Project({ useInMemoryFileSystem: true })
  const sourceFile = project.createSourceFile("source.tsx", source)

  const tokens: string[] = []
  for (const node of sourceFile.getDescendants()) {
    const token = tokenForNode(node)
    if (token !== undefined) tokens.push(token)
  }

  return createHash("sha256").update(tokens.join("|")).digest("hex")
}

/**
 * Build the fingerprint token for a single syntax node, or `undefined` to
 * skip the node (empty JSX text only).
 */
function tokenForNode(node: Node): string | undefined {
  // String literals and no-substitution templates: emit the literal value,
  // not the source text, so the quote delimiter cannot change the fingerprint.
  const stringLit = node.asKind(SyntaxKind.StringLiteral)
  if (stringLit) {
    return `${node.getKindName()}:${JSON.stringify(stringLit.getLiteralValue())}`
  }
  const templateLit = node.asKind(SyntaxKind.NoSubstitutionTemplateLiteral)
  if (templateLit) {
    return `${node.getKindName()}:${JSON.stringify(templateLit.getLiteralValue())}`
  }

  const kind = node.getKind()

  // Identifiers and numeric literals: emit their text.
  if (kind === SyntaxKind.Identifier || kind === SyntaxKind.NumericLiteral) {
    return `${node.getKindName()}:${node.getText()}`
  }

  // JSX text: emit the trimmed text; skip when it is only whitespace.
  if (kind === SyntaxKind.JsxText) {
    const trimmed = node.getText().trim()
    if (trimmed === "") return undefined
    return `${node.getKindName()}:${JSON.stringify(trimmed)}`
  }

  // Everything else: the kind name alone.
  return node.getKindName()
}
