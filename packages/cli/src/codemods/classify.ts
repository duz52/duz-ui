/**
 * Agent UI — codemod component classification.
 *
 * Determines what migration should do with a component based on its file name.
 * The classification is a fact about the component kind, not a decision about
 * the file contents — `planMigration` handles the content-level decision.
 */

import { SIGNATURES } from "./signatures.js"

export type Classification =
  | { kind: "migratable"; name: string }
  | { kind: "presentation" }
  | { kind: "explicit-semantics" }
  | { kind: "unknown" }

/**
 * Stock shadcn components with no intrinsic agent semantics. They expose
 * nothing to agents and are never touched by migration.
 */
const PRESENTATION_COMPONENTS = new Set([
  "card",
  "badge",
  "avatar",
  "separator",
  "skeleton",
  "aspect-ratio",
  "alert",
  "breadcrumb",
  "progress",
  "scroll-area",
  "sonner",
  "tooltip",
  "table",
  "label",
])

const MIGRATABLE_NAMES = new Set(SIGNATURES.map((s) => s.name))

/**
 * Classify a component by its file base name (without extension).
 *
 * - `migratable` — the component is in the Agent UI signature set.
 * - `explicit-semantics` — `button`; the component cannot infer what
 *   `onClick` means, so it never becomes an automatic agent action.
 * - `presentation` — stock shadcn components with no agent semantics.
 * - `unknown` — everything else, including components that have real agent
 *   semantics but no Agent UI implementation yet (accordion, calendar, form,
 *   etc.). Migration must not touch them.
 */
export function classify(componentName: string): Classification {
  if (MIGRATABLE_NAMES.has(componentName)) {
    return { kind: "migratable", name: componentName }
  }
  if (componentName === "button") {
    return { kind: "explicit-semantics" }
  }
  if (PRESENTATION_COMPONENTS.has(componentName)) {
    return { kind: "presentation" }
  }
  return { kind: "unknown" }
}
