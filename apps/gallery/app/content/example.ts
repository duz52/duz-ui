import type * as React from "react"

/**
 * The contract every gallery example module fulfils: a live preview
 * component and the usage snippet shown on the component detail page. Both
 * arrive together from one dynamic import, so a page suspends once for the
 * pair.
 *
 * Where examples live:
 *
 * - `app/content/examples/<name>.tsx` — one hand-written shared source per
 *   example whose usage is identical across bases. Its imports point at the
 *   radix tree; `scripts/sync-gallery.mjs` rewrites the specifiers per base
 *   into `app/content/examples/.generated/<base>/<name>.tsx`, so every base
 *   renders the same source a user gets after `npx agent-ui add`. Every
 *   preview there uses only the props both bases' grammars share.
 * - `app/content/examples/overrides/<base>/<name>.tsx` — hand-written
 *   replacements for components whose *usage*, not just internals, differs
 *   between bases, or that only one base carries. The divergence table in
 *   docs/internal/reference/base-ui.md is the list.
 * - `app/content/examples.<base>.generated.ts` — the generated lazy-loader
 *   map per base. The generator resolves the override-or-shared choice into
 *   it, so consumers never merge anything.
 *
 * Agent-native previews pass the `agent` prop; presentation components
 * register no capability and their previews carry none.
 */
export interface Example {
  Preview: React.ComponentType
  usage: string
}
