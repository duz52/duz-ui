/**
 * toggle example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import * as React from "react"

import { Toggle } from "@/components/radix/ui/toggle"

export function Preview(): React.JSX.Element {
  const [pressed, setPressed] = React.useState<boolean>(false)
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={setPressed}
      agent={{ id: "preview-toggle", label: "Preview toggle" }}
    >
      Bold
    </Toggle>
  )
}

export const usage = `<Toggle
  pressed={bold}
  onPressedChange={setBold}
  agent={{ id: "bold", label: "Bold" }}
>
  Bold
</Toggle>`
