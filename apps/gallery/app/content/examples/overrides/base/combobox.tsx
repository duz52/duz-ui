/**
 * Combobox example for the base tree — hand-written because the
 * bases' usage differs here: Base UI only — Radix has no combobox primitive.
 */

import * as React from "react"

import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/base/ui/combobox"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string | null>(null)
  return (
    <Combobox
      value={value}
      onValueChange={setValue}
      agent={{ id: "preview-combobox", label: "Preview combobox" }}
    >
      <ComboboxInput showTrigger className="w-48" placeholder="Framework" />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxItem value="react">React</ComboboxItem>
          <ComboboxItem value="vue">Vue</ComboboxItem>
          <ComboboxItem value="solid">Solid</ComboboxItem>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export const usage = `<Combobox
  value={value}
  onValueChange={setValue}
  agent={{ id: "framework", label: "Framework" }}
>
  <ComboboxInput showTrigger placeholder="Framework" />
  <ComboboxContent>
    <ComboboxList>
      <ComboboxItem value="react">React</ComboboxItem>
      <ComboboxItem value="vue">Vue</ComboboxItem>
      <ComboboxItem value="solid">Solid</ComboboxItem>
    </ComboboxList>
  </ComboboxContent>
</Combobox>`
