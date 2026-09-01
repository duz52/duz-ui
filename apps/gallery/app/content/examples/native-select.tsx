/**
 * native-select example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import * as React from "react"

import { NativeSelect, NativeSelectOption } from "@/components/radix/ui/native-select"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string>("standard")
  return (
    <NativeSelect
      value={value}
      onValueChange={setValue}
      agent={{ id: "preview-native-select", label: "Preview native select" }}
      className="w-48"
    >
      <NativeSelectOption value="standard">Standard</NativeSelectOption>
      <NativeSelectOption value="express">Express</NativeSelectOption>
      <NativeSelectOption value="overnight">Overnight</NativeSelectOption>
    </NativeSelect>
  )
}

export const usage = `<NativeSelect
  value={value}
  onValueChange={setValue}
  agent={{ id: "shipping-method", label: "Shipping method" }}
>
  <NativeSelectOption value="standard">Standard</NativeSelectOption>
  <NativeSelectOption value="express">Express</NativeSelectOption>
  <NativeSelectOption value="overnight">Overnight</NativeSelectOption>
</NativeSelect>`
