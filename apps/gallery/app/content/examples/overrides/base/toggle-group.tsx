/**
 * Toggle group example for the base tree — hand-written because the
 * bases' usage differs here: Base UI spells the mode `multiple` and always holds an array.
 */

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/base/ui/toggle-group"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string[]>(["bold"])
  return (
    <ToggleGroup
      multiple
      value={value}
      onValueChange={setValue}
      variant="outline"
      agent={{ id: "preview-toggle-group", label: "Preview toggle group" }}
    >
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
    </ToggleGroup>
  )
}

export const usage = `<ToggleGroup
  multiple
  value={styles}
  onValueChange={setStyles}
  agent={{ id: "text-styles", label: "Text styles" }}
>
  <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
  <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
</ToggleGroup>`
