/**
 * Duz UI — codemod component classification.
 *
 * Determines what migration should do with a component based on its file name.
 * The classification is a fact about the component kind, not a decision about
 * the file contents — `planMigration` handles the content-level decision.
 */

import { SIGNATURES } from "./signatures.js"

export type Classification =
  | { kind: "migratable"; name: string }
  | { kind: "presentation" }
  | { kind: "unknown" }

/**
 * Stock shadcn components that carry no state and no actions. There is
 * nothing on them for an agent to operate, so migration never touches them.
 */
const PRESENTATION_COMPONENTS = new Set([
  "badge",
  "avatar",
  "separator",
  "skeleton",
  "aspect-ratio",
  "alert",
  "breadcrumb",
  "progress",
  "scroll-area",
  "tooltip",
  "label",
  "pagination",
])

const MIGRATABLE_NAMES = new Set(SIGNATURES.map((s) => s.name))

/**
 * Classify a component by its file base name (without extension).
 *
 * - `migratable` — the component is in the Duz UI signature set.
 * - `presentation` — stock shadcn components with no agent semantics.
 * - `unknown` — everything else, including components that have real agent
 *   semantics but no Duz UI implementation yet (accordion, calendar, form,
 *   etc.). Migration must not touch them.
 */
export function classify(componentName: string): Classification {
  if (MIGRATABLE_NAMES.has(componentName)) {
    return { kind: "migratable", name: componentName }
  }
  if (PRESENTATION_COMPONENTS.has(componentName)) {
    return { kind: "presentation" }
  }
  return { kind: "unknown" }
}
