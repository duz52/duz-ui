/**
 * Dropdown menu example for the base tree — hand-written because the
 * bases' usage differs here: its trigger composes a Button via Base UI's `render` prop, which Radix spells `asChild`.
 */

import * as React from "react"

import { Button } from "@/components/base/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/base/ui/dropdown-menu"

export function Preview(): React.JSX.Element {
  const [showLineNumbers, setShowLineNumbers] = React.useState<boolean>(true)
  const [theme, setTheme] = React.useState<string>("system")
  return (
    <DropdownMenu agent={{ id: "preview-dropdown-menu", label: "Preview dropdown menu" }}>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          id="preview-dropdown-line-numbers"
          checked={showLineNumbers}
          onCheckedChange={(v) => setShowLineNumbers(v === true)}
          agent={{ id: "preview-dropdown-line-numbers", label: "Line numbers" }}
        >
          Line numbers
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup
          id="preview-dropdown-theme"
          value={theme}
          onValueChange={(value) => setTheme(value ?? "")}
          agent={{ id: "preview-dropdown-theme", label: "Theme" }}
        >
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const usage = `<DropdownMenu agent={{ id: "editor-menu", label: "Editor menu" }}>
  <DropdownMenuTrigger render={<Button variant="outline" />}>
    Open
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuCheckboxItem
      checked={showLineNumbers}
      onCheckedChange={(v) => setShowLineNumbers(v === true)}
      agent={{ id: "line-numbers", label: "Line numbers" }}
    >
      Line numbers
    </DropdownMenuCheckboxItem>
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(v) => setTheme(v ?? "")}
      agent={{ id: "theme", label: "Theme" }}
    >
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`
