"use client"

/**
 * Hand-written example overrides for the radix base, written against this
 * base's own components and merged over the generated shared map by
 * app/routes/component.tsx (the override wins).
 *
 * What belongs here: a component whose *usage*, not just its internals,
 * differs between bases. The divergence table in
 * docs/internal/reference/base-ui.md is the list. A component whose usage is
 * identical across bases belongs in app/content/examples.tsx, where the
 * per-base import rewrite still catches compile-time drift.
 *
 * The differences served here: Radix composes a trigger with a Button via
 * `asChild` (Base UI uses `render`), the accordion takes `type="single"`
 * with a string value (Base UI takes `multiple` with an array), and the OTP
 * input takes `maxLength` with slots that carry an explicit `index` (Base UI
 * takes `length` with slots that guess their index from DOM order).
 */

import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/radix/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/radix/ui/alert-dialog"
import { Button } from "@/components/radix/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/radix/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/radix/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/radix/ui/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/radix/ui/hover-card"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/radix/ui/input-otp"
import { Label } from "@/components/radix/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/radix/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/radix/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/radix/ui/tooltip"

import type { Example } from "@/content/examples"

// ---------------------------------------------------------------------------
// Accordion — Radix discriminates single and multiple with `type`
// ---------------------------------------------------------------------------

function AccordionExample(): React.JSX.Element {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="item-1"
      agent={{ id: "preview-accordion", label: "Preview accordion" }}
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>What is Agent UI?</AccordionTrigger>
        <AccordionContent>
          A registry of agent-native React components for real applications.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How do I add a component?</AccordionTrigger>
        <AccordionContent>
          Run <code>npx agent-ui add</code> and pick the component.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

const ACCORDION_USAGE = `<Accordion
  type="single"
  collapsible
  defaultValue="item-1"
  agent={{ id: "faq", label: "FAQ" }}
>
  <AccordionItem value="item-1">
    <AccordionTrigger>What is Agent UI?</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>`

// ---------------------------------------------------------------------------
// Input OTP — Radix names the length `maxLength` and slots carry `index`
// ---------------------------------------------------------------------------

function InputOTPExample(): React.JSX.Element {
  const [value, setValue] = React.useState<string>("")
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-input-otp">Verification code</Label>
      <InputOTP
        id="preview-input-otp"
        maxLength={6}
        value={value}
        onChange={setValue}
        agent={{ id: "preview-input-otp", label: "Preview input otp" }}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}

const INPUT_OTP_USAGE = `<InputOTP
  maxLength={6}
  value={code}
  onChange={setCode}
  agent={{ id: "verification-code", label: "Verification code" }}
>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>`

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function DialogExample(): React.JSX.Element {
  return (
    <Dialog agent={{ id: "preview-dialog", label: "Preview dialog" }}>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>
            This dialog is a fully agent-operable surface.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

const DIALOG_USAGE = `<Dialog agent={{ id: "confirm-dialog", label: "Confirm" }}>
  <DialogTrigger asChild>
    <Button variant="outline">Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm action</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>`

// ---------------------------------------------------------------------------
// Collapsible
// ---------------------------------------------------------------------------

function CollapsibleExample(): React.JSX.Element {
  return (
    <Collapsible agent={{ id: "preview-collapsible", label: "Preview collapsible" }}>
      <CollapsibleTrigger asChild>
        <Button variant="outline">Show details</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-sm text-muted-foreground">
          These are the hidden details an agent can reveal.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}

const COLLAPSIBLE_USAGE = `<Collapsible agent={{ id: "details", label: "Details" }}>
  <CollapsibleTrigger asChild>
    <Button variant="outline">Show details</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <p>…</p>
  </CollapsibleContent>
</Collapsible>`

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

function SheetExample(): React.JSX.Element {
  return (
    <Sheet agent={{ id: "preview-sheet", label: "Preview sheet" }}>
      <SheetTrigger asChild>
        <Button variant="outline">Open sheet</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Account settings</SheetTitle>
          <SheetDescription>
            Make changes to your account here.
          </SheetDescription>
        </SheetHeader>
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Profile, notifications and security live in this panel.
        </p>
      </SheetContent>
    </Sheet>
  )
}

const SHEET_USAGE = `<Sheet agent={{ id: "settings-sheet", label: "Settings" }}>
  <SheetTrigger asChild>
    <Button variant="outline">Open</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>…</SheetDescription>
    </SheetHeader>
    <p>…</p>
  </SheetContent>
</Sheet>`

// ---------------------------------------------------------------------------
// Alert dialog
// ---------------------------------------------------------------------------

function AlertDialogExample(): React.JSX.Element {
  return (
    <AlertDialog agent={{ id: "preview-alert-dialog", label: "Preview alert dialog" }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete project</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the project and all of its data. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const ALERT_DIALOG_USAGE = `<AlertDialog agent={{ id: "delete-project", label: "Delete project" }}>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this project?</AlertDialogTitle>
      <AlertDialogDescription>…</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive">Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`

// ---------------------------------------------------------------------------
// Popover
// ---------------------------------------------------------------------------

function PopoverExample(): React.JSX.Element {
  return (
    <Popover agent={{ id: "preview-popover", label: "Preview popover" }}>
      <PopoverTrigger asChild>
        <Button variant="outline">Export options</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm text-muted-foreground">
          The export includes comments and version history.
        </p>
      </PopoverContent>
    </Popover>
  )
}

const POPOVER_USAGE = `<Popover agent={{ id: "export-options", label: "Export options" }}>
  <PopoverTrigger asChild>
    <Button variant="outline">Export</Button>
  </PopoverTrigger>
  <PopoverContent>
    <p>…</p>
  </PopoverContent>
</Popover>`

// ---------------------------------------------------------------------------
// Hover card
// ---------------------------------------------------------------------------

function HoverCardExample(): React.JSX.Element {
  return (
    <HoverCard agent={{ id: "preview-hover-card", label: "Preview hover card" }}>
      <HoverCardTrigger asChild>
        <Button variant="link">@agent-ui</Button>
      </HoverCardTrigger>
      <HoverCardContent className="space-y-1">
        <p className="text-sm font-medium">Agent UI</p>
        <p className="text-sm text-muted-foreground">
          Agent-native React components for real applications.
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

const HOVER_CARD_USAGE = `// A person opens this by hovering the trigger; an agent opens it
// explicitly with the "open" action.
<HoverCard agent={{ id: "profile-card", label: "Profile" }}>
  <HoverCardTrigger asChild>
    <Button variant="link">@agent-ui</Button>
  </HoverCardTrigger>
  <HoverCardContent>
    <p>…</p>
  </HoverCardContent>
</HoverCard>`

// ---------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------

function DropdownMenuExample(): React.JSX.Element {
  const [showLineNumbers, setShowLineNumbers] = React.useState<boolean>(true)
  const [theme, setTheme] = React.useState<string>("system")
  return (
    <DropdownMenu agent={{ id: "preview-dropdown-menu", label: "Preview dropdown menu" }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
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

const DROPDOWN_MENU_USAGE = `<DropdownMenu agent={{ id: "editor-menu", label: "Editor menu" }}>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open</Button>
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

// ---------------------------------------------------------------------------
// Tooltip — presentation only
// ---------------------------------------------------------------------------

function TooltipExample(): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Agent-native React components</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const TOOLTIP_USAGE = `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Hover</Button>
    </TooltipTrigger>
    <TooltipContent>Saved to your workspace</TooltipContent>
  </Tooltip>
</TooltipProvider>`

// ---------------------------------------------------------------------------
// Registry — partial: merged over the generated shared map
// ---------------------------------------------------------------------------

export const EXAMPLE_OVERRIDES: Record<string, Example> = {
  accordion: { Preview: AccordionExample, usage: ACCORDION_USAGE },
  "input-otp": { Preview: InputOTPExample, usage: INPUT_OTP_USAGE },
  dialog: { Preview: DialogExample, usage: DIALOG_USAGE },
  collapsible: { Preview: CollapsibleExample, usage: COLLAPSIBLE_USAGE },
  sheet: { Preview: SheetExample, usage: SHEET_USAGE },
  "alert-dialog": { Preview: AlertDialogExample, usage: ALERT_DIALOG_USAGE },
  popover: { Preview: PopoverExample, usage: POPOVER_USAGE },
  "hover-card": { Preview: HoverCardExample, usage: HOVER_CARD_USAGE },
  "dropdown-menu": { Preview: DropdownMenuExample, usage: DROPDOWN_MENU_USAGE },
  tooltip: { Preview: TooltipExample, usage: TOOLTIP_USAGE },
}
