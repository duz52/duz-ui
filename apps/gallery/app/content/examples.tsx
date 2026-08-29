"use client"

/**
 * Live previews and usage snippets for every gallery component whose usage
 * is identical across bases — the single hand-written source. Its imports
 * point at the radix tree; `scripts/sync-gallery.mjs` emits one module per
 * base (`examples.<base>.generated.tsx`) by rewriting only these import
 * specifiers, so every base renders the same source a user gets after
 * `npx agent-ui add`. Agent-native previews pass the `agent` prop;
 * presentation components register no capability and their previews carry
 * none. The `usage` string is the short snippet shown on the component
 * detail page.
 *
 * Every preview here uses only the props both bases' grammars share: the
 * generated per-base module must compile against each base's component tree.
 * A component whose *usage* differs between bases does not belong here — it
 * has a hand-written example per base in `examples-overrides/<base>.tsx`,
 * and the divergence table in docs/internal/reference/base-ui.md is the
 * list of those.
 */

import * as React from "react"

import { Checkbox } from "@/components/radix/ui/checkbox"
import { DataTable, type DataTableColumn } from "@/components/radix/ui/data-table"
import { Input } from "@/components/radix/ui/input"
import { Label } from "@/components/radix/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/radix/ui/pagination"
import { RadioGroup, RadioGroupItem } from "@/components/radix/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/radix/ui/select"
import { Separator } from "@/components/radix/ui/separator"
import { Skeleton } from "@/components/radix/ui/skeleton"
import { Slider } from "@/components/radix/ui/slider"
import { Switch } from "@/components/radix/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/radix/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/radix/ui/tabs"
import { Textarea } from "@/components/radix/ui/textarea"
import { Toggle } from "@/components/radix/ui/toggle"
import { Button } from "@/components/radix/ui/button"

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

// Every key here compiles against both bases' trees unchanged. Components
// whose usage differs per base — accordion, input-otp, and every trigger
// paired with a Button (`asChild` in Radix, `render` in Base UI) — are
// defined once per base in examples-overrides/<base>.tsx instead.
export const EXAMPLES: Record<string, Example> = {
  "data-table": { Preview: DataTableExample, usage: DATA_TABLE_USAGE },
  tabs: { Preview: TabsExample, usage: TABS_USAGE },
  select: { Preview: SelectExample, usage: SELECT_USAGE },
  checkbox: { Preview: CheckboxExample, usage: CHECKBOX_USAGE },
  input: { Preview: InputExample, usage: INPUT_USAGE },
  textarea: { Preview: TextareaExample, usage: TEXTAREA_USAGE },
  switch: { Preview: SwitchExample, usage: SWITCH_USAGE },
  "radio-group": { Preview: RadioGroupExample, usage: RADIO_GROUP_USAGE },
  button: { Preview: ButtonExample, usage: BUTTON_USAGE },
  label: { Preview: LabelExample, usage: LABEL_USAGE },
  table: { Preview: TableExample, usage: TABLE_USAGE },
  slider: { Preview: SliderExample, usage: SLIDER_USAGE },
  toggle: { Preview: ToggleExample, usage: TOGGLE_USAGE },
  separator: { Preview: SeparatorExample, usage: SEPARATOR_USAGE },
  skeleton: { Preview: SkeletonExample, usage: SKELETON_USAGE },
  pagination: { Preview: PaginationExample, usage: PAGINATION_USAGE },
}
