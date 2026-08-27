/**
 * Agent UI — registry document schemas.
 *
 * Zod schemas mirroring the shape `packages/registry/build.ts` emits. Every
 * fetched document is validated against these before it reaches the CLI.
 */

import { z } from "zod"

/**
 * Agent capability metadata for a component. `kind` and `actions` exist only
 * for an agent-native component: a presentation-only component has no semantic
 * surface, and a business action's meaning is supplied by the application, not
 * by the component.
 */
export const agentUiMetaSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("agent-native"),
    kind: z.string(),
    actions: z.array(z.string()),
  }),
  z.object({ status: z.literal("presentation") }),
  z.object({ status: z.literal("explicit-semantics") }),
])

export const registryFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: z.string(),
  target: z.string(),
})

export const registryItemSchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  type: z.string(),
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
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
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
