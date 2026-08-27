"use client"

/**
 * Live previews and usage snippets for every gallery component.
 *
 * Each preview mounts the real installed component (from `@/components/ui/*`)
 * with the `agent` prop, so the capability it registers is the same one a user
 * gets after `npx agent-ui add`. The `usage` string is the short snippet shown
 * on the component detail page.
 */

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
}
