/**
 * Toggle group example for the radix tree — hand-written because the
 * bases' usage differs here: Radix discriminates single and multiple with `type`.
 */

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/radix/ui/toggle-group"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string[]>(["bold"])
  return (
    <ToggleGroup
      type="multiple"
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
  type="multiple"
  value={styles}
  onValueChange={setStyles}
  agent={{ id: "text-styles", label: "Text styles" }}
>
  <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
  <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
</ToggleGroup>`
