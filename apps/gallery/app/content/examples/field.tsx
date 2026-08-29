/**
 * field example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Field, FieldDescription, FieldLabel } from "@/components/radix/ui/field"
import { Input } from "@/components/radix/ui/input"

export function Preview(): React.JSX.Element {
  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="preview-field">Display name</FieldLabel>
      <Input id="preview-field" placeholder="Ada Lovelace" />
      <FieldDescription>Shown on your profile and in comments.</FieldDescription>
    </Field>
  )
}

export const usage = `<Field>
  <FieldLabel htmlFor="display-name">Display name</FieldLabel>
  <Input id="display-name" placeholder="Ada Lovelace" />
  <FieldDescription>Shown on your profile.</FieldDescription>
</Field>`
