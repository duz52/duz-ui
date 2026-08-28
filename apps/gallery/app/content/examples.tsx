"use client"

/**
 * Live previews and usage snippets for every gallery component.
 *
 * Each preview mounts the real installed component (from `@/components/ui/*`),
 * so what it renders is the same thing a user gets after `npx agent-ui add`.
 * Agent-native previews pass the `agent` prop; presentation components
 * register no capability and their previews carry none. The `usage` string is
 * the short snippet shown on the component detail page.
 */

import * as React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

export interface Example {
  Preview: React.ComponentType
  usage: string
}

// ---------------------------------------------------------------------------
// Data table
// ---------------------------------------------------------------------------

interface PreviewRow {
  id: string
  name: string
  role: string
  joined: string
}

const PREVIEW_ROWS: PreviewRow[] = [
  { id: "u1", name: "Ada Lovelace", role: "Engineer", joined: "2024-01" },
  { id: "u2", name: "Alan Turing", role: "Researcher", joined: "2023-11" },
  { id: "u3", name: "Grace Hopper", role: "Lead", joined: "2022-06" },
]

const PREVIEW_COLUMNS: DataTableColumn<PreviewRow>[] = [
  { id: "id", header: "ID", accessor: (r) => r.id },
  { id: "name", header: "Name", accessor: (r) => r.name },
  { id: "role", header: "Role", accessor: (r) => r.role },
  { id: "joined", header: "Joined", accessor: (r) => r.joined },
]

function DataTableExample(): React.JSX.Element {
  return (
    <DataTable
      data={PREVIEW_ROWS}
      columns={PREVIEW_COLUMNS}
      getRowId={(r) => r.id}
      agent={{ id: "preview-data-table", label: "Preview data table" }}
      pageSize={5}
    />
  )
}

const DATA_TABLE_USAGE = `<DataTable
  data={orders}
  columns={columns}
  getRowId={(order) => order.id}
  agent={{ id: "orders", label: "Orders" }}
/>`

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabsExample(): React.JSX.Element {
  return (
    <Tabs
      defaultValue="account"
      agent={{ id: "preview-tabs", label: "Preview tabs" }}
    >
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account settings.</TabsContent>
      <TabsContent value="billing">Billing details.</TabsContent>
      <TabsContent value="team">Team members.</TabsContent>
    </Tabs>
  )
}

const TABS_USAGE = `<Tabs
  defaultValue="account"
  agent={{ id: "settings-tabs", label: "Settings" }}
>
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="billing">Billing</TabsTrigger>
  </TabsList>
  <TabsContent value="account">…</TabsContent>
  <TabsContent value="billing">…</TabsContent>
</Tabs>`

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

function SelectExample(): React.JSX.Element {
  return (
    <Select
      defaultValue="standard"
      agent={{ id: "preview-select", label: "Preview select" }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Shipping method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="standard">Standard</SelectItem>
        <SelectItem value="express">Express</SelectItem>
        <SelectItem value="overnight">Overnight</SelectItem>
      </SelectContent>
    </Select>
  )
}

const SELECT_USAGE = `<Select
  defaultValue="standard"
  agent={{ id: "shipping-method", label: "Shipping method" }}
>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Shipping method" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="standard">Standard</SelectItem>
    <SelectItem value="express">Express</SelectItem>
  </SelectContent>
</Select>`

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

function CheckboxExample(): React.JSX.Element {
  const [checked, setChecked] = React.useState<boolean>(false)
  return (
    <Label className="flex items-center gap-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
        agent={{ id: "preview-checkbox", label: "Preview checkbox" }}
      />
      Enable notifications
    </Label>
  )
}

const CHECKBOX_USAGE = `<Checkbox
  checked={enabled}
  onCheckedChange={setEnabled}
  agent={{ id: "notifications", label: "Enable notifications" }}
/>`

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
// Input
// ---------------------------------------------------------------------------

function InputExample(): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-input">Email</Label>
      <Input
        id="preview-input"
        type="email"
        placeholder="you@example.com"
        agent={{ id: "preview-input", label: "Preview input" }}
      />
    </div>
  )
}

const INPUT_USAGE = `<Input
  type="email"
  placeholder="you@example.com"
  agent={{ id: "contact-email", label: "Contact email" }}
/>`

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

function TextareaExample(): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-textarea">Bio</Label>
      <Textarea
        id="preview-textarea"
        placeholder="Tell us about yourself"
        agent={{ id: "preview-textarea", label: "Preview textarea" }}
      />
    </div>
  )
}

const TEXTAREA_USAGE = `<div className="space-y-1.5">
  <Label htmlFor="bio">Bio</Label>
  <Textarea
    id="bio"
    placeholder="Tell us about yourself"
    agent={{ id: "bio", label: "Bio" }}
  />
</div>`

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

function SwitchExample(): React.JSX.Element {
  const [checked, setChecked] = React.useState<boolean>(false)
  return (
    <div className="flex items-center gap-3">
      <Switch
        id="preview-switch"
        checked={checked}
        onCheckedChange={setChecked}
        agent={{ id: "preview-switch", label: "Preview switch" }}
      />
      <Label htmlFor="preview-switch">Enable notifications</Label>
    </div>
  )
}

const SWITCH_USAGE = `<div className="flex items-center gap-3">
  <Switch
    id="notifications"
    checked={enabled}
    onCheckedChange={setEnabled}
    agent={{ id: "notifications", label: "Enable notifications" }}
  />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>`

// ---------------------------------------------------------------------------
// Radio group
// ---------------------------------------------------------------------------

function RadioGroupExample(): React.JSX.Element {
  return (
    <RadioGroup
      id="preview-radio-group"
      aria-label="Shipping method"
      defaultValue="standard"
      agent={{ id: "preview-radio-group", label: "Preview radio group" }}
    >
      <div className="flex items-center gap-3">
        <RadioGroupItem value="standard" id="preview-radio-standard" />
        <Label htmlFor="preview-radio-standard">Standard</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="express" id="preview-radio-express" />
        <Label htmlFor="preview-radio-express">Express</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="overnight" id="preview-radio-overnight" />
        <Label htmlFor="preview-radio-overnight">Overnight</Label>
      </div>
    </RadioGroup>
  )
}

const RADIO_GROUP_USAGE = `<RadioGroup
  id="plan"
  aria-label="Plan"
  defaultValue="free"
  agent={{ id: "plan", label: "Plan" }}
>
  <div className="flex items-center gap-3">
    <RadioGroupItem value="free" id="plan-free" />
    <Label htmlFor="plan-free">Free</Label>
  </div>
  <div className="flex items-center gap-3">
    <RadioGroupItem value="pro" id="plan-pro" />
    <Label htmlFor="plan-pro">Pro</Label>
  </div>
</RadioGroup>`

// ---------------------------------------------------------------------------
// Button — explicit semantics, no agent prop
// ---------------------------------------------------------------------------

function ButtonExample(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  )
}

const BUTTON_USAGE = `// A button never becomes an agent action automatically.
// Wrap it in <AgentAction> to expose business semantics:
<AgentAction
  id="refresh-orders"
  description="Refresh the orders list."
  execute={refresh}
>
  <Button variant="outline">Refresh</Button>
</AgentAction>`

// ---------------------------------------------------------------------------
// Label — presentation only
// ---------------------------------------------------------------------------

function LabelExample(): React.JSX.Element {
  return (
    <Label htmlFor="label-demo">Form label</Label>
  )
}

const LABEL_USAGE = `<Label htmlFor="email">Email</Label>`

// ---------------------------------------------------------------------------
// Table — presentation only
// ---------------------------------------------------------------------------

function TableExample(): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineer</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Alan Turing</TableCell>
          <TableCell>Researcher</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

const TABLE_USAGE = `<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Ada Lovelace</TableCell>
    </TableRow>
  </TableBody>
</Table>`

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

function AccordionExample(): React.JSX.Element {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="account"
      agent={{ id: "preview-accordion", label: "Preview accordion" }}
    >
      <AccordionItem value="account">
        <AccordionTrigger>Account settings</AccordionTrigger>
        <AccordionContent>Manage your account preferences.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="billing">
        <AccordionTrigger>Billing details</AccordionTrigger>
        <AccordionContent>Update your billing information.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="team">
        <AccordionTrigger>Team members</AccordionTrigger>
        <AccordionContent>Invite and manage your team.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

const ACCORDION_USAGE = `<Accordion
  type="single"
  collapsible
  defaultValue="account"
  agent={{ id: "settings", label: "Settings" }}
>
  <AccordionItem value="account">
    <AccordionTrigger>Account</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
  <AccordionItem value="billing">
    <AccordionTrigger>Billing</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>`

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

function SliderExample(): React.JSX.Element {
  const [value, setValue] = React.useState<number[]>([50])
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="preview-slider">Volume</Label>
        <span className="text-sm text-muted-foreground">{value[0]}</span>
      </div>
      <Slider
        id="preview-slider"
        min={0}
        max={100}
        step={5}
        value={value}
        onValueChange={setValue}
        agent={{ id: "preview-slider", label: "Preview slider" }}
      />
    </div>
  )
}

const SLIDER_USAGE = `<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label htmlFor="volume">Volume</Label>
    <span className="text-sm text-muted-foreground">{value[0]}</span>
  </div>
  <Slider
    id="volume"
    min={0}
    max={100}
    step={5}
    value={value}
    onValueChange={setValue}
    agent={{ id: "volume", label: "Volume" }}
  />
</div>`

// ---------------------------------------------------------------------------
// Input OTP
// ---------------------------------------------------------------------------

function InputOTPExample(): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-input-otp">Verification code</Label>
      <InputOTP
        id="preview-input-otp"
        maxLength={6}
        agent={{ id: "preview-input-otp", label: "Preview input OTP" }}
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
// Toggle
// ---------------------------------------------------------------------------

function ToggleExample(): React.JSX.Element {
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

const TOGGLE_USAGE = `<Toggle
  pressed={bold}
  onPressedChange={setBold}
  agent={{ id: "bold", label: "Bold" }}
>
  Bold
</Toggle>`

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
          onValueChange={setTheme}
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
      onCheckedChange={setShowLineNumbers}
      agent={{ id: "line-numbers", label: "Line numbers" }}
    >
      Line numbers
    </DropdownMenuCheckboxItem>
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={setTheme}
      agent={{ id: "theme", label: "Theme" }}
    >
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`

// ---------------------------------------------------------------------------
// Separator — presentation only
// ---------------------------------------------------------------------------

function SeparatorExample(): React.JSX.Element {
  return (
    <div className="max-w-xs space-y-3">
      <p className="text-sm">Workspace settings</p>
      <Separator />
      <p className="text-sm text-muted-foreground">
        Changes apply to every member of the workspace.
      </p>
    </div>
  )
}

const SEPARATOR_USAGE = `<p>Workspace settings</p>
<Separator />
<p className="text-sm text-muted-foreground">…</p>`

// ---------------------------------------------------------------------------
// Skeleton — presentation only
// ---------------------------------------------------------------------------

function SkeletonExample(): React.JSX.Element {
  return (
    <div className="flex w-full max-w-xs items-center gap-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

const SKELETON_USAGE = `<div className="flex items-center gap-4">
  <Skeleton className="size-10 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>`

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
// Pagination — presentation only
// ---------------------------------------------------------------------------

function PaginationExample(): React.JSX.Element {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

const PAGINATION_USAGE = `// Which page is current belongs to the application's router, so the
// component exposes nothing to an agent.
<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="/orders?page=1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/orders?page=1">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/orders?page=2" isActive>
        2
      </PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="/orders?page=3" />
    </PaginationItem>
  </PaginationContent>
</Pagination>`

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const EXAMPLES: Record<string, Example> = {
  "data-table": { Preview: DataTableExample, usage: DATA_TABLE_USAGE },
  tabs: { Preview: TabsExample, usage: TABS_USAGE },
  select: { Preview: SelectExample, usage: SELECT_USAGE },
  checkbox: { Preview: CheckboxExample, usage: CHECKBOX_USAGE },
  dialog: { Preview: DialogExample, usage: DIALOG_USAGE },
  input: { Preview: InputExample, usage: INPUT_USAGE },
  textarea: { Preview: TextareaExample, usage: TEXTAREA_USAGE },
  switch: { Preview: SwitchExample, usage: SWITCH_USAGE },
  "radio-group": { Preview: RadioGroupExample, usage: RADIO_GROUP_USAGE },
  button: { Preview: ButtonExample, usage: BUTTON_USAGE },
  label: { Preview: LabelExample, usage: LABEL_USAGE },
  table: { Preview: TableExample, usage: TABLE_USAGE },
  accordion: { Preview: AccordionExample, usage: ACCORDION_USAGE },
  slider: { Preview: SliderExample, usage: SLIDER_USAGE },
  "input-otp": { Preview: InputOTPExample, usage: INPUT_OTP_USAGE },
  toggle: { Preview: ToggleExample, usage: TOGGLE_USAGE },
  collapsible: { Preview: CollapsibleExample, usage: COLLAPSIBLE_USAGE },
  sheet: { Preview: SheetExample, usage: SHEET_USAGE },
  "alert-dialog": { Preview: AlertDialogExample, usage: ALERT_DIALOG_USAGE },
  popover: { Preview: PopoverExample, usage: POPOVER_USAGE },
  "hover-card": { Preview: HoverCardExample, usage: HOVER_CARD_USAGE },
  "dropdown-menu": { Preview: DropdownMenuExample, usage: DROPDOWN_MENU_USAGE },
  separator: { Preview: SeparatorExample, usage: SEPARATOR_USAGE },
  skeleton: { Preview: SkeletonExample, usage: SKELETON_USAGE },
  tooltip: { Preview: TooltipExample, usage: TOOLTIP_USAGE },
  pagination: { Preview: PaginationExample, usage: PAGINATION_USAGE },
}
