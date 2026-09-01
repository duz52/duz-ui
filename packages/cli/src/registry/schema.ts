/**
 * Duz UI — registry document schemas.
 *
 * Zod schemas mirroring the shape `packages/registry/build.ts` emits. Every
 * fetched document is validated against these before it reaches the CLI.
 */

import { z } from "zod"

/**
 * Agent capability metadata for a component. `capabilities` exist only for an
 * agent-native component: a presentation-only component has no semantic
 * surface, and a business action's meaning is supplied by the application,
 * not by the component. A single file may expose more than one capability
 * (for example a dropdown menu whose root is a disclosure, whose checkbox
 * item is a checkbox, and whose radio group is a select), so `capabilities`
 * is always a list — even when a component exposes exactly one. There is no
 * single-capability shorthand alongside it: two ways to say the same thing is
 * how a data model starts lying.
 */
export const agentUiMetaSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("agent-native"),
    capabilities: z
      .array(
        z.object({
          kind: z.string(),
          actions: z.array(z.string()),
        }),
      )
      .min(1),
  }),
  z.object({ status: z.literal("presentation") }),
])

/**
 * The shadcn file/item type. A hook is its own type, not a lib or a ui
 * component: it lands under `hooks/` and is create-or-overwrite.
 */
export const registryFileTypeSchema = z.enum([
  "registry:lib",
  "registry:ui",
  "registry:hook",
])

export const registryFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: registryFileTypeSchema,
  target: z.string(),
})

export const registryItemSchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  type: registryFileTypeSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  files: z.array(registryFileSchema),
  agentUi: agentUiMetaSchema.optional(),
})

/** The index carries item metadata without file contents, so it stays small. */
const registryIndexItemSchema = z.object({
  name: z.string(),
  type: registryFileTypeSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  /**
   * The primitive bases this item is emitted for. Absent means the item is
   * base-independent and served once, at the registry root.
   */
  bases: z.array(z.string()).optional(),
  agentUi: agentUiMetaSchema.optional(),
})

export const registryIndexSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().optional(),
  homepage: z.string().optional(),
  items: z.array(registryIndexItemSchema),
})

export type AgentUiMeta = z.infer<typeof agentUiMetaSchema>
export type RegistryFile = z.infer<typeof registryFileSchema>
export type RegistryItem = z.infer<typeof registryItemSchema>
export type RegistryIndex = z.infer<typeof registryIndexSchema>
export type RegistryIndexItem = z.infer<typeof registryIndexItemSchema>
