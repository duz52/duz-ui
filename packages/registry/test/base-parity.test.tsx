import assert from "node:assert/strict"
import test, { before } from "node:test"

import { JSDOM } from "jsdom"

/**
 * Base-parity behavioural contract.
 *
 * The SAME assertions run against BOTH primitive trees: the base is a
 * parameter resolved through a dynamic import, never a copy-paste. For every
 * value-holding component it proves that an agent action travels through the
 * application, in both mountings:
 *
 * 1. Controlled — the application owns the value in React state. The
 *    application's change handler must run with the new value, and the tool
 *    must report the state the application now holds.
 * 2. Uncontrolled — the component owns its state. The application's change
 *    handler must still run, or every application side effect on change is
 *    lost.
 *
 * A tree that wires the primitive's callback separately from the capability's
 * state setter fails both: controlled actions become silent no-ops, and
 * uncontrolled actions update the screen without ever telling the app.
 *
 * A kind with no actions cannot be driven, so its case shape proves the other
 * half of the contract: the capability registers with an empty action list
 * and `read()` reports the state the application gave it, identically on both
 * bases — and no tool exists to operate it.
 *
 * The jsdom host is duplicated from components.test.tsx (each test file runs
 * in its own process) and extended below with the globals the Base UI tree
 * and the select popups need. Those bindings are part of the test host, not
 * of Agent UI.
 */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://agent-ui.test/",
  pretendToBeVisual: true,
})

const globals = globalThis as Record<string, unknown>
globals["window"] = dom.window
globals["document"] = dom.window.document
globals["HTMLElement"] = dom.window.HTMLElement
globals["HTMLInputElement"] = dom.window.HTMLInputElement
globals["HTMLTextAreaElement"] = dom.window.HTMLTextAreaElement
globals["HTMLFormElement"] = dom.window.HTMLFormElement
globals["Event"] = dom.window.Event
globals["MouseEvent"] = dom.window.MouseEvent
globals["Node"] = dom.window.Node
// The accessible-name walk uses a TreeWalker, whose filter constants are a
// separate global. Without it every label resolution threw and fell back,
// logging a ReferenceError on each mount.
globals["NodeFilter"] = dom.window.NodeFilter
globals["DOMRect"] = dom.window.DOMRect
globals["getComputedStyle"] = dom.window.getComputedStyle.bind(dom.window)
globals["requestAnimationFrame"] = (callback: FrameRequestCallback) =>
  dom.window.setTimeout(() => callback(Date.now()), 0) as unknown as number
globals["cancelAnimationFrame"] = (handle: number) => dom.window.clearTimeout(handle)
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
})

// jsdom does not implement these, and Node's built-ins live in a different
// realm than the jsdom window, so every binding below must come from
// `dom.window`. They are part of the test host, not of Agent UI.
//
// - Element: Base UI's floating-ui layer does `instanceof Element` checks.
// - DocumentFragment, MutationObserver: Radix's select portal and focus scope.
// - CustomEvent, PointerEvent: Radix's dismissable layer dispatches these;
//   Node's global constructors would produce events jsdom refuses to dispatch.
globals["Element"] = dom.window.Element
globals["DocumentFragment"] = dom.window.DocumentFragment
globals["MutationObserver"] = dom.window.MutationObserver
globals["CustomEvent"] = dom.window.CustomEvent
globals["PointerEvent"] = dom.window.PointerEvent

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globals["ResizeObserver"] = ResizeObserverStub
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
if (!dom.window.matchMedia) {
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

type AnyProps = Record<string, unknown>
type ComponentModule = Record<string, React.ComponentType<AnyProps>>

const BASES = ["radix", "base"] as const

interface CaseDef {
  component: string
  /** The agent tool for this component and the argument it passes. */
  tool: string
  argument: AnyProps
  /** Frozen capability contract: identical for both bases. */
  kind: string
  actions: readonly string[]
  controlledProp: string
  /**
   * The prop that seeds the uncontrolled mounting, when the primitive's
   * grammar has one. cmdk's input has no default search, so the command
   * case mounts uncontrolled without any seeding prop.
   */
  defaultProp?: string
  /**
   * The application's change-callback prop. A function when the two
   * primitives name the callback differently — binding only, the handler
   * stays arity 1 in both.
   */
  changeProp: string | ((base: (typeof BASES)[number]) => string)
  initialValue: unknown
  newValue: unknown
  /** Key in the tool's reported state that mirrors the controlled prop. */
  stateKey: string
  /** Pulls the new value out of the change handler's argument list. */
  extractChange: (args: readonly unknown[]) => unknown
  /**
   * The value the capability layer reports through `read()` and accepts from
   * the tool, when it differs from the component-level value the primitive's
   * props and callbacks carry — the calendar's contract speaks ISO date
   * strings while react-day-picker works in Date objects. Absent means the
   * two are the same.
   */
  contractValue?: unknown
  /**
   * Extra props a base needs when the two primitives name the same concept
   * differently. Binding only — the capability contract stays identical.
   */
  baseProps?: (base: (typeof BASES)[number]) => AnyProps
  /**
   * The bases the case applies to; absent means every base. A component the
   * trees do not both carry — combobox exists only in the Base UI tree —
   * declares the bases it applies to, and the base stays a parameter.
   */
  bases?: readonly (typeof BASES)[number][]
  mount: (mod: ComponentModule, props: AnyProps) => React.ReactElement
}

function changePropName(def: CaseDef, base: (typeof BASES)[number]): string {
  return typeof def.changeProp === "function" ? def.changeProp(base) : def.changeProp
}

/** The cases a base runs: a case the base does not carry is skipped. */
function casesFor(base: (typeof BASES)[number]): readonly CaseDef[] {
  return CASES.filter((def) => def.bases === undefined || def.bases.includes(base))
}

const CASES: readonly CaseDef[] = [
  {
    component: "checkbox",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "checked",
    defaultProp: "defaultChecked",
    changeProp: "onCheckedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) => React.createElement(mod.Checkbox, props),
  },
  {
    component: "switch",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "checked",
    defaultProp: "defaultChecked",
    changeProp: "onCheckedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) => React.createElement(mod.Switch, props),
  },
  {
    component: "toggle",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "pressed",
    defaultProp: "defaultPressed",
    changeProp: "onPressedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) => React.createElement(mod.Toggle, props),
  },
  {
    component: "tabs",
    tool: "tabs_select",
    argument: { value: "shipping" },
    kind: "tabs",
    actions: ["select"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "account",
    newValue: "shipping",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.Tabs,
        props,
        React.createElement(
          mod.TabsList,
          null,
          React.createElement(mod.TabsTrigger, { value: "account" }, "Account"),
          React.createElement(mod.TabsTrigger, { value: "shipping" }, "Shipping"),
        ),
        React.createElement(mod.TabsContent, { value: "account" }, "account panel"),
        React.createElement(mod.TabsContent, { value: "shipping" }, "shipping panel"),
      ),
  },
  {
    component: "select",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // Mounted closed on purpose: a select must report its options and accept
      // a choice whether or not its popup has ever been opened.
      React.createElement(
        mod.Select,
        props,
        React.createElement(
          mod.SelectTrigger,
          null,
          React.createElement(mod.SelectValue, null),
        ),
        React.createElement(
          mod.SelectContent,
          null,
          React.createElement(mod.SelectItem, { value: "pending" }, "Pending"),
          React.createElement(mod.SelectItem, { value: "paid" }, "Paid"),
        ),
      ),
  },
  {
    component: "native-select",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The wrapper owns the value channel, so the select is addressable
      // whether or not the user has ever interacted with it.
      React.createElement(
        mod.NativeSelect,
        props,
        React.createElement(mod.NativeSelectOption, { value: "pending" }, "Pending"),
        React.createElement(mod.NativeSelectOption, { value: "paid" }, "Paid"),
      ),
  },
  {
    component: "radio-group",
    tool: "select_choose",
    argument: { value: "standard" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "express",
    newValue: "standard",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.RadioGroup,
        props,
        React.createElement(mod.RadioGroupItem, { value: "express" }, "Express"),
        React.createElement(mod.RadioGroupItem, { value: "standard" }, "Standard"),
      ),
  },
  {
    component: "toggle-group",
    tool: "multi_select_set",
    argument: { values: ["bold", "italic"] },
    kind: "multi-select",
    actions: ["set"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: ["bold"],
    newValue: ["bold", "italic"],
    stateKey: "value",
    extractChange: (args) => args[0],
    // The app-facing mode spelling differs by base (Radix discriminates with
    // `type`, Base UI with a `multiple` flag); multiple mode is the binding
    // both primitives express identically: string[] in, string[] out.
    baseProps: (base) => (base === "radix" ? { type: "multiple" } : { multiple: true }),
    mount: (mod, props) =>
      React.createElement(
        mod.ToggleGroup,
        props,
        React.createElement(mod.ToggleGroupItem, { value: "bold" }, "Bold"),
        React.createElement(mod.ToggleGroupItem, { value: "italic" }, "Italic"),
        React.createElement(mod.ToggleGroupItem, { value: "underline" }, "Underline"),
      ),
  },
  {
    component: "combobox",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    // Radix has no combobox primitive, so the component exists in the Base
    // UI tree only.
    bases: ["base"],
    mount: (mod, props) =>
      // Mounted closed on purpose, like select: options are read from the
      // elements the content was given, not from items that have mounted.
      React.createElement(
        mod.Combobox,
        props,
        React.createElement(mod.ComboboxInput, { showTrigger: true }),
        React.createElement(
          mod.ComboboxContent,
          null,
          React.createElement(
            mod.ComboboxList,
            null,
            React.createElement(mod.ComboboxItem, { value: "pending" }, "Pending"),
            React.createElement(mod.ComboboxItem, { value: "paid" }, "Paid"),
          ),
        ),
      ),
  },
  {
    component: "combobox",
    tool: "multi_select_set",
    argument: { values: ["bold", "italic"] },
    kind: "multi-select",
    actions: ["set"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: ["bold"],
    newValue: ["bold", "italic"],
    stateKey: "value",
    extractChange: (args) => args[0],
    // Radix has no combobox primitive, so the component exists in the Base
    // UI tree only. Multiple mode is the binding the primitive expresses
    // directly: string[] in, string[] out.
    bases: ["base"],
    baseProps: () => ({ multiple: true }),
    mount: (mod, props) =>
      React.createElement(
        mod.Combobox,
        props,
        React.createElement(mod.ComboboxInput, { showTrigger: true }),
        React.createElement(
          mod.ComboboxContent,
          null,
          React.createElement(
            mod.ComboboxList,
            null,
            React.createElement(mod.ComboboxItem, { value: "bold" }, "Bold"),
            React.createElement(mod.ComboboxItem, { value: "italic" }, "Italic"),
            React.createElement(mod.ComboboxItem, { value: "underline" }, "Underline"),
          ),
        ),
      ),
  },
  {
    component: "input",
    tool: "input_set_value",
    argument: { value: "Northwind" },
    kind: "input",
    actions: ["clear", "set_value"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onChange",
    initialValue: "",
    newValue: "Northwind",
    stateKey: "value",
    extractChange: (args) => (args[0] as { target: { value: string } }).target.value,
    mount: (mod, props) => React.createElement(mod.Input, props),
  },
  {
    component: "textarea",
    tool: "input_set_value",
    argument: { value: "Northwind" },
    kind: "input",
    actions: ["clear", "set_value"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onChange",
    initialValue: "",
    newValue: "Northwind",
    stateKey: "value",
    extractChange: (args) => (args[0] as { target: { value: string } }).target.value,
    mount: (mod, props) => React.createElement(mod.Textarea, props),
  },
  {
    component: "input-otp",
    tool: "input_set_value",
    argument: { value: "1234" },
    kind: "input",
    actions: ["clear", "set_value"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    // The radix field names the change callback onChange (the input-otp
    // package's prop); Base UI's OTP field names it onValueChange.
    changeProp: (base) => (base === "radix" ? "onChange" : "onValueChange"),
    initialValue: "",
    newValue: "1234",
    stateKey: "value",
    extractChange: (args) => args[0],
    // Same binding split for the slot count: maxLength in the radix base,
    // length in Base UI. read() reports it as maxLength either way.
    baseProps: (base) => (base === "radix" ? { maxLength: 4 } : { length: 4 }),
    mount: (mod, props) =>
      React.createElement(
        mod.InputOTP,
        props,
        React.createElement(
          mod.InputOTPGroup,
          null,
          React.createElement(mod.InputOTPSlot),
          React.createElement(mod.InputOTPSlot),
          React.createElement(mod.InputOTPSlot),
          React.createElement(mod.InputOTPSlot),
        ),
      ),
  },
  {
    component: "command",
    tool: "input_set_value",
    argument: { value: "Northwind" },
    kind: "input",
    actions: ["clear", "set_value"],
    controlledProp: "value",
    changeProp: "onValueChange",
    initialValue: "",
    newValue: "Northwind",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // cmdk's input reads its search string from the root's store, so it
      // only mounts inside a Command root; the list content is the real
      // shape a command palette carries.
      React.createElement(
        mod.Command,
        null,
        React.createElement(mod.CommandInput, props),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(mod.CommandEmpty, null, "No results."),
          React.createElement(mod.CommandItem, null, "Item one"),
        ),
      ),
  },
  {
    component: "collapsible",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.Collapsible,
        props,
        React.createElement(mod.CollapsibleTrigger, null, "Toggle"),
        React.createElement(mod.CollapsibleContent, null, "details"),
      ),
  },
  {
    component: "hover-card",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.HoverCard,
        props,
        React.createElement(mod.HoverCardTrigger, null, "Hover"),
        React.createElement(mod.HoverCardContent, null, "hover card body"),
      ),
  },
  {
    component: "popover",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.Popover,
        props,
        React.createElement(mod.PopoverTrigger, null, "Open"),
        React.createElement(mod.PopoverContent, null, "popover body"),
      ),
  },
  {
    component: "sidebar",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The capability registers on SidebarProvider, not on Sidebar, so the
      // provider takes the test props and Sidebar is its real content.
      React.createElement(
        mod.SidebarProvider,
        props,
        React.createElement(
          mod.Sidebar,
          null,
          React.createElement(mod.SidebarContent, null, "navigation"),
        ),
      ),
  },
  {
    component: "dialog",
    tool: "dialog_open",
    argument: {},
    kind: "dialog",
    actions: ["close", "open"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The title registers through a React context, so a title part is part
      // of the real shape; without it the capability reports title: null.
      React.createElement(
        mod.Dialog,
        props,
        React.createElement(mod.DialogTrigger, null, "Open"),
        React.createElement(
          mod.DialogContent,
          null,
          React.createElement(mod.DialogTitle, null, "Confirm"),
        ),
      ),
  },
  {
    component: "alert-dialog",
    tool: "dialog_open",
    argument: {},
    kind: "dialog",
    actions: ["close", "open"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.AlertDialog,
        props,
        React.createElement(mod.AlertDialogTrigger, null, "Open"),
        React.createElement(
          mod.AlertDialogContent,
          null,
          React.createElement(mod.AlertDialogTitle, null, "Confirm"),
        ),
      ),
  },
  {
    component: "sheet",
    tool: "dialog_open",
    argument: {},
    kind: "dialog",
    actions: ["close", "open"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.Sheet,
        props,
        React.createElement(mod.SheetTrigger, null, "Open"),
        React.createElement(
          mod.SheetContent,
          null,
          React.createElement(mod.SheetTitle, null, "Details"),
        ),
      ),
  },
  {
    component: "drawer",
    tool: "dialog_open",
    argument: {},
    kind: "dialog",
    actions: ["close", "open"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.Drawer,
        props,
        React.createElement(mod.DrawerTrigger, null, "Open"),
        React.createElement(
          mod.DrawerContent,
          null,
          React.createElement(mod.DrawerTitle, null, "Details"),
        ),
      ),
  },
  {
    component: "accordion",
    tool: "accordion_expand",
    argument: { value: "shipping" },
    kind: "accordion",
    actions: ["collapse", "expand"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: ["account"],
    newValue: ["account", "shipping"],
    stateKey: "value",
    extractChange: (args) => args[0],
    // The app-facing change shape of a single-open accordion differs by base
    // (Radix emits a string, Base UI always an array). Multiple mode is the
    // binding both primitives express identically: string[] in, string[] out.
    baseProps: (base) => (base === "radix" ? { type: "multiple" } : { multiple: true }),
    mount: (mod, props) =>
      React.createElement(
        mod.Accordion,
        props,
        React.createElement(
          mod.AccordionItem,
          { value: "account" },
          React.createElement(mod.AccordionTrigger, null, "Account"),
          React.createElement(mod.AccordionContent, null, "account body"),
        ),
        React.createElement(
          mod.AccordionItem,
          { value: "shipping" },
          React.createElement(mod.AccordionTrigger, null, "Shipping"),
          React.createElement(mod.AccordionContent, null, "shipping body"),
        ),
      ),
  },
  {
    component: "slider",
    tool: "slider_set",
    argument: { value: [42] },
    kind: "slider",
    actions: ["set"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: [25],
    newValue: [42],
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) => React.createElement(mod.Slider, props),
  },
  {
    component: "calendar",
    tool: "date_set",
    argument: { value: ["2026-03-14"] },
    kind: "date",
    actions: ["set"],
    controlledProp: "selected",
    changeProp: "onSelect",
    initialValue: new Date(2026, 2, 10),
    newValue: new Date(2026, 2, 14),
    // The contract speaks ISO strings; the primitive works in Date objects.
    contractValue: ["2026-03-14"],
    stateKey: "value",
    extractChange: (args) => args[0],
    baseProps: () => ({ mode: "single" }),
    mount: (mod, props) => React.createElement(mod.Calendar, props),
  },
  {
    component: "calendar",
    tool: "date_set",
    argument: { value: ["2026-03-01", "2026-03-05"] },
    kind: "date",
    actions: ["set"],
    controlledProp: "selected",
    changeProp: "onSelect",
    initialValue: { from: new Date(2026, 1, 20), to: new Date(2026, 1, 25) },
    newValue: { from: new Date(2026, 2, 1), to: new Date(2026, 2, 5) },
    // The contract speaks ISO strings; the primitive works in { from, to }.
    contractValue: ["2026-03-01", "2026-03-05"],
    stateKey: "value",
    extractChange: (args) => args[0],
    baseProps: () => ({ mode: "range" }),
    mount: (mod, props) => React.createElement(mod.Calendar, props),
  },
  {
    component: "dropdown-menu",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.DropdownMenu,
        props,
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuItem, null, "Cut"),
        ),
      ),
  },
  {
    component: "dropdown-menu",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "checked",
    defaultProp: "defaultChecked",
    changeProp: "onCheckedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The item mounts only while the menu is open, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.DropdownMenu,
        { open: true },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuCheckboxItem, props, "Show grid"),
        ),
      ),
  },
  {
    component: "dropdown-menu",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The group's items mount only while the menu is open, and
      // select_choose refuses unregistered options, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.DropdownMenu,
        { open: true },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(
            mod.DropdownMenuRadioGroup,
            props,
            React.createElement(mod.DropdownMenuRadioItem, { value: "pending" }, "Pending"),
            React.createElement(mod.DropdownMenuRadioItem, { value: "paid" }, "Paid"),
          ),
        ),
      ),
  },
  {
    component: "context-menu",
    tool: "disclosure_open",
    argument: {},
    kind: "disclosure",
    actions: ["close", "open", "toggle"],
    controlledProp: "open",
    defaultProp: "defaultOpen",
    changeProp: "onOpenChange",
    initialValue: false,
    newValue: true,
    stateKey: "open",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      React.createElement(
        mod.ContextMenu,
        props,
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(mod.ContextMenuItem, null, "Cut"),
        ),
      ),
  },
  {
    component: "context-menu",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "checked",
    defaultProp: "defaultChecked",
    changeProp: "onCheckedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The item mounts only while the menu is open, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.ContextMenu,
        { open: true },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(mod.ContextMenuCheckboxItem, props, "Show grid"),
        ),
      ),
  },
  {
    component: "context-menu",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The group's items mount only while the menu is open, and
      // select_choose refuses unregistered options, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.ContextMenu,
        { open: true },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(
            mod.ContextMenuRadioGroup,
            props,
            React.createElement(mod.ContextMenuRadioItem, { value: "pending" }, "Pending"),
            React.createElement(mod.ContextMenuRadioItem, { value: "paid" }, "Paid"),
          ),
        ),
      ),
  },
  {
    component: "navigation-menu",
    tool: "select_choose",
    argument: { value: "shipping" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "account",
    newValue: "shipping",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // Items register with the root on mount, independent of open state, so
      // both items are addressable whether or not one is open.
      React.createElement(
        mod.NavigationMenu,
        props,
        React.createElement(
          mod.NavigationMenuList,
          null,
          React.createElement(
            mod.NavigationMenuItem,
            { value: "account" },
            React.createElement(mod.NavigationMenuTrigger, null, "Account"),
            React.createElement(
              mod.NavigationMenuContent,
              null,
              React.createElement(mod.NavigationMenuLink, { href: "#" }, "Sign out"),
            ),
          ),
          React.createElement(
            mod.NavigationMenuItem,
            { value: "shipping" },
            React.createElement(mod.NavigationMenuTrigger, null, "Shipping"),
            React.createElement(
              mod.NavigationMenuContent,
              null,
              React.createElement(mod.NavigationMenuLink, { href: "#" }, "Track order"),
            ),
          ),
        ),
      ),
  },
  {
    component: "menubar",
    tool: "select_choose",
    argument: { value: "shipping" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "account",
    newValue: "shipping",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // Menus register with the root on mount, independent of open state, so
      // both menus are addressable whether or not one is open.
      React.createElement(
        mod.Menubar,
        props,
        React.createElement(
          mod.MenubarMenu,
          { value: "account" },
          React.createElement(mod.MenubarTrigger, null, "Account"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "Sign out"),
          ),
        ),
        React.createElement(
          mod.MenubarMenu,
          { value: "shipping" },
          React.createElement(mod.MenubarTrigger, null, "Shipping"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "Track order"),
          ),
        ),
      ),
  },
  {
    component: "menubar",
    tool: "checkbox_set",
    argument: { checked: true },
    kind: "checkbox",
    actions: ["set"],
    controlledProp: "checked",
    defaultProp: "defaultChecked",
    changeProp: "onCheckedChange",
    initialValue: false,
    newValue: true,
    stateKey: "checked",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The item mounts only while its menu is open, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.Menubar,
        { defaultValue: "view" },
        React.createElement(
          mod.MenubarMenu,
          { value: "view" },
          React.createElement(mod.MenubarTrigger, null, "View"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarCheckboxItem, props, "Show grid"),
          ),
        ),
      ),
  },
  {
    component: "menubar",
    tool: "select_choose",
    argument: { value: "paid" },
    kind: "select",
    actions: ["choose", "clear"],
    controlledProp: "value",
    defaultProp: "defaultValue",
    changeProp: "onValueChange",
    initialValue: "pending",
    newValue: "paid",
    stateKey: "value",
    extractChange: (args) => args[0],
    mount: (mod, props) =>
      // The group's items mount only while their menu is open, and
      // select_choose refuses unregistered options, so the test mounts the
      // menu open — the same shape for both bases.
      React.createElement(
        mod.Menubar,
        { defaultValue: "view" },
        React.createElement(
          mod.MenubarMenu,
          { value: "view" },
          React.createElement(mod.MenubarTrigger, null, "View"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(
              mod.MenubarRadioGroup,
              props,
              React.createElement(mod.MenubarRadioItem, { value: "pending" }, "Pending"),
              React.createElement(mod.MenubarRadioItem, { value: "paid" }, "Paid"),
            ),
          ),
        ),
      ),
  },
]

interface ReadOnlyCaseDef {
  component: string
  kind: string
  /** A read-only capability operates nothing, so its action list is empty. */
  actions: readonly string[]
  /** Identical props for both bases; `value: null` is valid in both. */
  props: AnyProps
  /** The exact state `read()` must report for `props`. */
  state: Record<string, unknown>
  mount: (mod: ComponentModule, props: AnyProps) => React.ReactElement
}

const READ_ONLY_CASES: readonly ReadOnlyCaseDef[] = [
  {
    component: "progress",
    kind: "progress",
    actions: [],
    props: { value: 64 },
    state: { value: 64, max: 100 },
    mount: (mod, props) => React.createElement(mod.Progress, props),
  },
  {
    component: "progress",
    kind: "progress",
    actions: [],
    props: { value: null, max: 10 },
    state: { value: null, max: 10 },
    mount: (mod, props) => React.createElement(mod.Progress, props),
  },
]

/** Loaded for the per-base tests below that are not driven by a case table. */
const EXTRA_MODULES = ["card", "data-table", "table"] as const

let React: typeof import("react")
let createRoot: typeof import("react-dom/client").createRoot
let registry: import("../src/lib/agent-ui/registry").CapabilityRegistry
let createAgentTools: typeof import("../src/lib/agent-ui/tools").createAgentTools
const modules = new Map<string, ComponentModule>()

before(async () => {
  React = await import("react")
  ;({ createRoot } = await import("react-dom/client"))
  registry = (await import("../src/lib/agent-ui/registry")).getCapabilityRegistry()
  ;({ createAgentTools } = await import("../src/lib/agent-ui/tools"))
  for (const base of BASES) {
    for (const def of casesFor(base)) {
      modules.set(
        `${base}/${def.component}`,
        (await import(`../src/bases/${base}/ui/${def.component}`)) as ComponentModule,
      )
    }
    for (const def of READ_ONLY_CASES) {
      modules.set(
        `${base}/${def.component}`,
        (await import(`../src/bases/${base}/ui/${def.component}`)) as ComponentModule,
      )
    }
    // Components asserted on outside the case tables.
    for (const name of EXTRA_MODULES) {
      modules.set(
        `${base}/${name}`,
        (await import(`../src/bases/${base}/ui/${name}`)) as ComponentModule,
      )
    }
  }
})

async function withAct<T>(fn: () => Promise<T>): Promise<T> {
  globals["IS_REACT_ACT_ENVIRONMENT"] = true
  try {
    return await React.act(fn)
  } finally {
    globals["IS_REACT_ACT_ENVIRONMENT"] = false
  }
}

async function mount(element: React.ReactElement) {
  const container = dom.window.document.createElement("div")
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  await withAct(async () => {
    root.render(element)
  })
  return {
    container,
    async unmount() {
      await withAct(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function tool(name: string) {
  const found = createAgentTools(registry).find((candidate) => candidate.name === name)
  assert.ok(found, `expected the "${name}" tool to exist`)
  return found
}

/**
 * The ordinary controlled wiring an application writes: the value lives in
 * application state and every change is echoed back through the handler.
 */
function ControlledHost(props: {
  def: CaseDef
  mod: ComponentModule
  id: string
  seen: unknown[]
  base: (typeof BASES)[number]
}) {
  const { def, mod, id, seen, base } = props
  const [value, setValue] = React.useState(def.initialValue)
  return def.mount(mod, {
    agent: { id },
    ...def.baseProps?.(base),
    [def.controlledProp]: value,
    [changePropName(def, base)]: (...args: unknown[]) => {
      seen.push(def.extractChange(args))
      setValue(seen[seen.length - 1])
    },
  })
}

for (const base of BASES) {
  test(`[${base}] capability descriptors match the frozen contract`, async () => {
    for (const def of casesFor(base)) {
      const id = `${base}-${def.component}-descriptor`
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const tree = await mount(def.mount(mod, { agent: { id }, ...def.baseProps?.(base) }))

      const capability = registry.get(id)
      assert.ok(capability, `${def.component} must register a capability while mounted`)
      assert.equal(capability.kind, def.kind, `${def.component}: kind`)
      assert.deepEqual(
        [...capability.actions].sort(),
        def.actions,
        `${def.component}: actions`,
      )

      await tree.unmount()
    }
  })

  for (const def of casesFor(base)) {
    test(`[${base}] ${def.component}: the agent's action reaches a controlled ${def.controlledProp} through the application`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const seen: unknown[] = []
      const id = `${base}-${def.component}-controlled`
      const tree = await mount(
        React.createElement(ControlledHost, { def, mod, id, seen, base }),
      )

      const output = JSON.parse(await tool(def.tool).execute({ target: id, ...def.argument }))

      assert.deepEqual(
        seen,
        [def.newValue],
        `the application's ${changePropName(def, base)} must run with ${JSON.stringify(def.newValue)}`,
      )
      // deepEqual, not equal: the accordion, slider and calendar contracts
      // report an array value, which strict identity can never hold across
      // JSON.parse. For every primitive-valued case it asserts exactly what
      // equal did.
      assert.deepEqual(
        output.state[def.stateKey],
        def.contractValue ?? def.newValue,
        `the tool must report the ${def.controlledProp} the application now holds`,
      )

      await tree.unmount()
    })

    test(`[${base}] ${def.component}: the agent's action notifies the application of an uncontrolled ${def.controlledProp} change`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const seen: unknown[] = []
      const id = `${base}-${def.component}-uncontrolled`
      const tree = await mount(
        def.mount(mod, {
          agent: { id },
          ...def.baseProps?.(base),
          ...(def.defaultProp === undefined
            ? {}
            : { [def.defaultProp]: def.initialValue }),
          [changePropName(def, base)]: (...args: unknown[]) => {
            seen.push(def.extractChange(args))
          },
        }),
      )

      await tool(def.tool).execute({ target: id, ...def.argument })

      assert.deepEqual(
        seen,
        [def.newValue],
        `the application's ${changePropName(def, base)} must run even when the component owns its state`,
      )

      await tree.unmount()
    })
  }

  test(`[${base}] button: registers one capability whose label is its visible text`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-label`
    const tree = await mount(
      React.createElement(mod.Button, { agent: { id } }, "Send Invitation"),
    )

    const capability = registry.get(id)
    assert.ok(capability, "button must register a capability while mounted")
    assert.equal(capability.kind, "button")
    assert.deepEqual([...capability.actions], ["press"])
    assert.equal(capability.label, "Send Invitation")
    assert.deepEqual(registry.read(id), {
      label: "Send Invitation",
      disabled: false,
      type: "button",
    })

    await tree.unmount()
  })

  test(`[${base}] button: press fires the button's onClick`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-press`
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Button,
        { agent: { id }, onClick: () => seen.push("click") },
        "Save changes",
      ),
    )

    const output = JSON.parse(await tool("button_press").execute({ target: id }))

    assert.equal(output.ok, true)
    assert.deepEqual(seen, ["click"], "press must run the application's onClick")

    await tree.unmount()
  })

  test(`[${base}] button: press on a submit button inside a form submits it`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-submit`
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        "form",
        {
          onSubmit: (event: React.FormEvent) => {
            event.preventDefault()
            seen.push("submit")
          },
        },
        React.createElement(
          mod.Button,
          { agent: { id }, type: "submit" },
          "Send Invitation",
        ),
      ),
    )

    const output = JSON.parse(await tool("button_press").execute({ target: id }))

    assert.equal(output.ok, true)
    assert.deepEqual(
      seen,
      ["submit"],
      "a click on a submit button must submit the surrounding form",
    )

    await tree.unmount()
  })

  test(`[${base}] button: press on a disabled button is rejected naming the button and runs nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-disabled`
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Button,
        {
          agent: { id },
          disabled: true,
          onClick: () => seen.push("click"),
        },
        "Send Invitation",
      ),
    )

    const output = JSON.parse(await tool("button_press").execute({ target: id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.equal(
      output.error.message,
      '"Send Invitation" is disabled and cannot be pressed right now.',
    )
    assert.deepEqual(
      seen,
      [],
      "a disabled button must never run the application's onClick",
    )

    await tree.unmount()
  })

  test(`[${base}] button: agent={false} registers nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const tree = await mount(
      React.createElement(mod.Button, { agent: false }, "Send Invitation"),
    )

    assert.deepEqual(registry.describeAll(), [])

    await tree.unmount()
  })

  /**
   * A menu's items are the point of the menu: opening it must reveal them,
   * each named by its own text and owned by the menu, and pressing one must
   * reach the application's handler. The content is unmounted while closed,
   * so a closed menu honestly lists no items — and the items appearing once
   * it opens is what makes every per-row action reachable.
   */
  test(`[${base}] dropdown-menu: a closed menu registers only the menu itself`, async () => {
    const mod = modules.get(`${base}/dropdown-menu`)
    assert.ok(mod, `the ${base} dropdown-menu module must load`)
    const id = `${base}-dropdown-menu-closed-items`
    const tree = await mount(
      React.createElement(
        mod.DropdownMenu,
        { agent: { id } },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuItem, null, "Cut"),
          React.createElement(mod.DropdownMenuItem, null, "Copy payment ID"),
        ),
      ),
    )

    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        label: capability.label,
        owner: capability.owner,
      })),
      [{ id, kind: "disclosure", label: "Open", owner: undefined }],
    )

    await tree.unmount()
  })

  test(`[${base}] dropdown-menu: opening the menu reveals its items, each owned by the menu`, async () => {
    const mod = modules.get(`${base}/dropdown-menu`)
    assert.ok(mod, `the ${base} dropdown-menu module must load`)
    const id = `${base}-dropdown-menu-open-items`
    const tree = await mount(
      React.createElement(
        mod.DropdownMenu,
        { agent: { id } },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuItem, null, "Cut"),
          React.createElement(mod.DropdownMenuItem, null, "Copy payment ID"),
        ),
      ),
    )

    // Outside `act`, like every tool call in this file: the open action's
    // commit mounts the content, and the items register from that commit.
    await tool("disclosure_open").execute({ target: id })

    assert.deepEqual(
      registry
        .describeAll()
        .filter((capability) => capability.kind === "button")
        .map((capability) => ({
          label: capability.label,
          owner: capability.owner,
        })),
      [
        { label: "Cut", owner: id },
        { label: "Copy payment ID", owner: id },
      ],
    )

    await tree.unmount()
  })

  test(`[${base}] dropdown-menu: button_press on an item fires the application's handler`, async () => {
    const mod = modules.get(`${base}/dropdown-menu`)
    assert.ok(mod, `the ${base} dropdown-menu module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.DropdownMenu,
        { open: true },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(
            mod.DropdownMenuItem,
            // Radix items activate through onSelect, Base UI items through
            // onClick; each is the application's activation handler.
            base === "radix"
              ? { onSelect: () => seen.push("activate") }
              : { onClick: () => seen.push("activate") },
            "Delete row",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, true)
    assert.deepEqual(seen, ["activate"], "press must run the application's handler")

    await tree.unmount()
  })

  test(`[${base}] dropdown-menu: pressing a disabled item is rejected naming the item and runs nothing`, async () => {
    const mod = modules.get(`${base}/dropdown-menu`)
    assert.ok(mod, `the ${base} dropdown-menu module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.DropdownMenu,
        { open: true },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(
            mod.DropdownMenuItem,
            {
              disabled: true,
              ...(base === "radix"
                ? { onSelect: () => seen.push("activate") }
                : { onClick: () => seen.push("activate") }),
            },
            "Delete row",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.equal(
      output.error.message,
      '"Delete row" is disabled and cannot be pressed right now.',
    )
    assert.deepEqual(
      seen,
      [],
      "a disabled item must never run the application's handler",
    )

    await tree.unmount()
  })

  test(`[${base}] dropdown-menu: a checkbox item inside the menu is owned by the menu`, async () => {
    const mod = modules.get(`${base}/dropdown-menu`)
    assert.ok(mod, `the ${base} dropdown-menu module must load`)
    const id = `${base}-dropdown-menu-checkbox-owner`
    const tree = await mount(
      React.createElement(
        mod.DropdownMenu,
        { open: true, agent: { id } },
        React.createElement(mod.DropdownMenuTrigger, null, "Open"),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuCheckboxItem, null, "Show grid"),
        ),
      ),
    )

    const checkbox = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(checkbox, "the menu's checkbox item must register a capability")
    assert.equal(checkbox.owner, id, "the checkbox item must be owned by the menu")

    await tree.unmount()
  })

  test(`[${base}] context-menu: a closed menu registers only the menu itself`, async () => {
    const mod = modules.get(`${base}/context-menu`)
    assert.ok(mod, `the ${base} context-menu module must load`)
    const id = `${base}-context-menu-closed-items`
    const tree = await mount(
      React.createElement(
        mod.ContextMenu,
        { agent: { id } },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(mod.ContextMenuItem, null, "Cut"),
        ),
      ),
    )

    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        label: capability.label,
        owner: capability.owner,
      })),
      [{ id, kind: "disclosure", label: "Context menu", owner: undefined }],
    )

    await tree.unmount()
  })

  test(`[${base}] context-menu: opening the menu reveals its items, each owned by the menu`, async () => {
    const mod = modules.get(`${base}/context-menu`)
    assert.ok(mod, `the ${base} context-menu module must load`)
    const id = `${base}-context-menu-open-items`
    const tree = await mount(
      React.createElement(
        mod.ContextMenu,
        { agent: { id } },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(mod.ContextMenuItem, null, "Cut"),
          React.createElement(mod.ContextMenuItem, null, "Duplicate"),
        ),
      ),
    )

    await tool("disclosure_open").execute({ target: id })

    assert.deepEqual(
      registry
        .describeAll()
        .filter((capability) => capability.kind === "button")
        .map((capability) => ({
          label: capability.label,
          owner: capability.owner,
        })),
      [
        { label: "Cut", owner: id },
        { label: "Duplicate", owner: id },
      ],
    )

    await tree.unmount()
  })

  test(`[${base}] context-menu: button_press on an item fires the application's handler`, async () => {
    const mod = modules.get(`${base}/context-menu`)
    assert.ok(mod, `the ${base} context-menu module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.ContextMenu,
        { open: true },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(
            mod.ContextMenuItem,
            base === "radix"
              ? { onSelect: () => seen.push("activate") }
              : { onClick: () => seen.push("activate") },
            "Delete row",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, true)
    assert.deepEqual(seen, ["activate"], "press must run the application's handler")

    await tree.unmount()
  })

  test(`[${base}] context-menu: pressing a disabled item is rejected naming the item and runs nothing`, async () => {
    const mod = modules.get(`${base}/context-menu`)
    assert.ok(mod, `the ${base} context-menu module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.ContextMenu,
        { open: true },
        React.createElement(mod.ContextMenuTrigger, null, "Right click"),
        React.createElement(
          mod.ContextMenuContent,
          null,
          React.createElement(
            mod.ContextMenuItem,
            {
              disabled: true,
              ...(base === "radix"
                ? { onSelect: () => seen.push("activate") }
                : { onClick: () => seen.push("activate") }),
            },
            "Delete row",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.equal(
      output.error.message,
      '"Delete row" is disabled and cannot be pressed right now.',
    )
    assert.deepEqual(
      seen,
      [],
      "a disabled item must never run the application's handler",
    )

    await tree.unmount()
  })

  test(`[${base}] menubar: a closed menubar registers itself and its menus, but no item capabilities`, async () => {
    const mod = modules.get(`${base}/menubar`)
    assert.ok(mod, `the ${base} menubar module must load`)
    const tree = await mount(
      React.createElement(
        mod.Menubar,
        null,
        React.createElement(
          mod.MenubarMenu,
          { value: "file" },
          React.createElement(mod.MenubarTrigger, null, "File"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "New file"),
          ),
        ),
        React.createElement(
          mod.MenubarMenu,
          { value: "edit" },
          React.createElement(mod.MenubarTrigger, null, "Edit"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "Undo"),
          ),
        ),
      ),
    )

    // Sorted: the menus re-register when their trigger's name arrives, so
    // registration order is not stable enough to assert directly.
    assert.deepEqual(
      registry
        .describeAll()
        .map((capability) => `${capability.kind}:${capability.label}`)
        .sort(),
      ["disclosure:Edit", "disclosure:File", "select:Menubar"],
    )

    await tree.unmount()
  })

  test(`[${base}] menubar: opening a menu reveals its items, each owned by that menu`, async () => {
    const mod = modules.get(`${base}/menubar`)
    assert.ok(mod, `the ${base} menubar module must load`)
    const tree = await mount(
      React.createElement(
        mod.Menubar,
        null,
        React.createElement(
          mod.MenubarMenu,
          { value: "file" },
          React.createElement(mod.MenubarTrigger, null, "File"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "New file"),
            React.createElement(mod.MenubarItem, null, "Open recent"),
          ),
        ),
        React.createElement(
          mod.MenubarMenu,
          { value: "edit" },
          React.createElement(mod.MenubarTrigger, null, "Edit"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarItem, null, "Undo"),
          ),
        ),
      ),
    )

    const fileMenu = registry
      .describeAll()
      .find(
        (capability) =>
          capability.kind === "disclosure" && capability.label === "File",
      )
    assert.ok(fileMenu, "the menubar's File menu must register a disclosure")

    await tool("disclosure_open").execute({ target: fileMenu.id })

    assert.deepEqual(
      registry
        .describeAll()
        .filter((capability) => capability.kind === "button")
        .map((capability) => ({
          label: capability.label,
          owner: capability.owner,
        })),
      [
        { label: "New file", owner: fileMenu.id },
        { label: "Open recent", owner: fileMenu.id },
      ],
    )

    await tree.unmount()
  })

  test(`[${base}] menubar: button_press on an item fires the application's handler`, async () => {
    const mod = modules.get(`${base}/menubar`)
    assert.ok(mod, `the ${base} menubar module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Menubar,
        { defaultValue: "file" },
        React.createElement(
          mod.MenubarMenu,
          { value: "file" },
          React.createElement(mod.MenubarTrigger, null, "File"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(
              mod.MenubarItem,
              base === "radix"
                ? { onSelect: () => seen.push("activate") }
                : { onClick: () => seen.push("activate") },
              "New file",
            ),
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, true)
    assert.deepEqual(seen, ["activate"], "press must run the application's handler")

    await tree.unmount()
  })

  test(`[${base}] menubar: pressing a disabled item is rejected naming the item and runs nothing`, async () => {
    const mod = modules.get(`${base}/menubar`)
    assert.ok(mod, `the ${base} menubar module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Menubar,
        { defaultValue: "file" },
        React.createElement(
          mod.MenubarMenu,
          { value: "file" },
          React.createElement(mod.MenubarTrigger, null, "File"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(
              mod.MenubarItem,
              {
                disabled: true,
                ...(base === "radix"
                  ? { onSelect: () => seen.push("activate") }
                  : { onClick: () => seen.push("activate") }),
              },
              "Delete row",
            ),
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(item, "the open menu's item must register a capability")
    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.equal(
      output.error.message,
      '"Delete row" is disabled and cannot be pressed right now.',
    )
    assert.deepEqual(
      seen,
      [],
      "a disabled item must never run the application's handler",
    )

    await tree.unmount()
  })

  test(`[${base}] menubar: a checkbox item inside a menu is owned by that menu`, async () => {
    const mod = modules.get(`${base}/menubar`)
    assert.ok(mod, `the ${base} menubar module must load`)
    const tree = await mount(
      React.createElement(
        mod.Menubar,
        { defaultValue: "view" },
        React.createElement(
          mod.MenubarMenu,
          { value: "view" },
          React.createElement(mod.MenubarTrigger, null, "View"),
          React.createElement(
            mod.MenubarContent,
            null,
            React.createElement(mod.MenubarCheckboxItem, null, "Show grid"),
          ),
        ),
      ),
    )

    const viewMenu = registry
      .describeAll()
      .find(
        (capability) =>
          capability.kind === "disclosure" && capability.label === "View",
      )
    assert.ok(viewMenu, "the menubar's View menu must register a disclosure")

    const checkbox = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(checkbox, "the menu's checkbox item must register a capability")
    assert.equal(checkbox.owner, viewMenu.id, "the checkbox item must be owned by its menu")

    await tree.unmount()
  })
}

for (const base of BASES) {
  for (const def of READ_ONLY_CASES) {
    test(`[${base}] ${def.component}: a capability with no actions reports its state and offers no tool`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const id = `${base}-${def.component}-readonly-${JSON.stringify(def.props)}`
      const tree = await mount(def.mount(mod, { agent: { id }, ...def.props }))

      const capability = registry.get(id)
      assert.ok(capability, `${def.component} must register a capability while mounted`)
      assert.equal(capability.kind, def.kind, `${def.component}: kind`)
      assert.deepEqual([...capability.actions], def.actions, `${def.component}: actions`)
      assert.deepEqual(capability.read(), def.state, `${def.component}: read()`)

      // Only the two discovery tools exist while a read-only capability is
      // the sole mounted capability: no kind tool may exist for a surface
      // nothing can operate.
      assert.deepEqual(
        createAgentTools(registry).map((candidate) => candidate.name),
        ["ui_list", "ui_read"],
      )

      await tree.unmount()
    })
  }
}

/**
 * Card and table carry the page's actual content, so they register a
 * `content` capability — an ordinary capability whose action map is empty.
 * The reads below sit outside `act`, exactly like every tool call in this
 * file: a read is answered from the committed DOM, and wrapping one in `act`
 * would defer that commit and answer with pre-transition state.
 */
for (const base of BASES) {
  test(`[${base}] card: registers one content capability that reads its parts`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const id = `${base}-card-content`
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: { id } },
        React.createElement(
          mod.CardHeader,
          null,
          React.createElement(mod.CardTitle, null, "Total revenue"),
          React.createElement(mod.CardDescription, null, "For the last 30 days"),
        ),
        React.createElement(mod.CardContent, null, "$45,231"),
      ),
    )

    assert.deepEqual(
      registry.describeAll().map((capability) => capability.id),
      [id],
      "the card must be the only capability its subtree registers",
    )
    assert.deepEqual(registry.read(id), {
      title: "Total revenue",
      description: "For the last 30 days",
      content: "$45,231",
      footer: null,
    })

    await tree.unmount()
  })

  test(`[${base}] card: sibling blocks read as separate words, not one fused token`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const id = `${base}-card-block-boundaries`
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: { id } },
        React.createElement(
          mod.CardContent,
          null,
          React.createElement("div", null, "$45,231.89"),
          React.createElement("p", null, "+20.1% from last month"),
        ),
      ),
    )

    // textContent would fuse these into "$45,231.89+20.1% from last month",
    // which reads as arithmetic rather than as two facts.
    assert.equal(
      (registry.read(id) as { content: string }).content,
      "$45,231.89 +20.1% from last month",
    )

    await tree.unmount()
  })

  test(`[${base}] card: a part that is not rendered reads as null, not a missing key`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const id = `${base}-card-absent-part`
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: { id } },
        React.createElement(mod.CardTitle, null, "Just a title"),
        React.createElement(mod.CardContent, null, "body"),
      ),
    )

    assert.deepEqual(registry.read(id), {
      title: "Just a title",
      description: null,
      content: "body",
      footer: null,
    })

    await tree.unmount()
  })

  test(`[${base}] table: reads columns and rows keyed by header text`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const id = `${base}-table-content`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableHeader,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableHead, null, "Name"),
            React.createElement(mod.TableHead, null, "Email"),
            React.createElement(mod.TableHead, null, "Status"),
          ),
        ),
        React.createElement(
          mod.TableBody,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableCell, null, "Ada"),
            React.createElement(mod.TableCell, null, "ada@example.com"),
            React.createElement(mod.TableCell, null, "Paid"),
          ),
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableCell, null, "Grace"),
            React.createElement(mod.TableCell, null, "grace@example.com"),
            React.createElement(mod.TableCell, null, "Refunded"),
          ),
        ),
      ),
    )

    assert.deepEqual(registry.read(id), {
      columns: ["Name", "Email", "Status"],
      rows: [
        { Name: "Ada", Email: "ada@example.com", Status: "Paid" },
        { Name: "Grace", Email: "grace@example.com", Status: "Refunded" },
      ],
      renderedRowCount: 2,
      totalRowCount: null,
    })

    await tree.unmount()
  })

  test(`[${base}] table: a read reports every rendered row, bounded only by the tools layer`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const id = `${base}-table-window`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableHeader,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableHead, null, "Item"),
          ),
        ),
        React.createElement(
          mod.TableBody,
          null,
          Array.from({ length: 60 }, (_, index) =>
            React.createElement(
              mod.TableRow,
              { key: index },
              React.createElement(mod.TableCell, null, `cell ${index}`),
            ),
          ),
        ),
      ),
    )

    const state = registry.read(id) as {
      columns: string[]
      rows: Record<string, string>[]
      renderedRowCount: number
      totalRowCount: number | null
    }
    // The component reports what the table has; cutting it to the output
    // budget, and saying how to walk the rest, belongs to the tools layer —
    // one windowing mechanism, not two.
    assert.equal(state.rows.length, 60)
    assert.equal(state.renderedRowCount, 60)
    assert.equal(state.totalRowCount, null)
    assert.deepEqual(state.columns, ["Item"])
    assert.deepEqual(state.rows[0], { Item: "cell 0" })
    assert.deepEqual(state.rows[59], { Item: "cell 59" })

    await tree.unmount()
  })

  test(`[${base}] card and table: agent={false} registers nothing`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tableMod = modules.get(`${base}/table`)
    assert.ok(tableMod, `the ${base} table module must load`)

    const cardTree = await mount(
      React.createElement(mod.Card, { agent: false }, "content"),
    )
    assert.deepEqual(registry.describeAll(), [])
    await cardTree.unmount()

    const tableTree = await mount(React.createElement(tableMod.Table, { agent: false }))
    assert.deepEqual(registry.describeAll(), [])
    await tableTree.unmount()
  })

  /**
   * A control inside a table belongs to that table's row, and the row belongs
   * to the table. Discovery must say so directly — `owner` names the table
   * and the label names the row — so an agent never has to brute-force the
   * mapping between a checkbox and the row it controls.
   */
  test(`[${base}] table: a row checkbox belongs to the table and is named by its row`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const id = `${base}-table-row-owner`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableHeader,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableHead, null, "Name"),
            React.createElement(mod.TableHead, null, "Email"),
          ),
        ),
        React.createElement(
          mod.TableBody,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(
              mod.TableCell,
              null,
              React.createElement(checkbox.Checkbox),
            ),
            React.createElement(mod.TableCell, null, "Ada"),
            React.createElement(mod.TableCell, null, "ada@lovelace.dev"),
          ),
        ),
      ),
    )

    // Outside `act`, like every read in this file: the label is composed when
    // the checkbox registers, from the row's committed cells.
    const rowCheckbox = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(rowCheckbox, "the row checkbox must register a capability")
    assert.equal(
      rowCheckbox.owner,
      id,
      "the row checkbox must be owned by the table",
    )
    // The checkbox's own cell has no text, so the row is named by the first
    // cell that does.
    assert.equal(rowCheckbox.label, "row 1: Ada — Checkbox")

    await tree.unmount()
  })

  test(`[${base}] table: an explicit agent label on a row control still wins`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const id = `${base}-table-row-explicit-label`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableBody,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(
              mod.TableCell,
              null,
              React.createElement(checkbox.Checkbox, { agent: { label: "Pick me" } }),
            ),
            React.createElement(mod.TableCell, null, "Ada"),
          ),
        ),
      ),
    )

    const rowCheckbox = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(rowCheckbox, "the row checkbox must register a capability")
    assert.equal(rowCheckbox.label, "Pick me")
    // Ownership is not the label's business: the control still belongs to
    // the table it was rendered in.
    assert.equal(rowCheckbox.owner, id)

    await tree.unmount()
  })

  test(`[${base}] table: row numbering counts body rows only`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const id = `${base}-table-row-numbering`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableHeader,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableHead, null, React.createElement(checkbox.Checkbox)),
            React.createElement(mod.TableHead, null, "Name"),
          ),
        ),
        React.createElement(
          mod.TableBody,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableCell, null, React.createElement(checkbox.Checkbox)),
            React.createElement(mod.TableCell, null, "Ada"),
          ),
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableCell, null, React.createElement(checkbox.Checkbox)),
            React.createElement(mod.TableCell, null, "Grace"),
          ),
        ),
      ),
    )

    // The header select-all is not "row 1": it claims no row position and
    // keeps the generic name, while the body rows number from 1.
    assert.deepEqual(
      registry
        .describeAll()
        .filter((capability) => capability.kind === "checkbox")
        .map((capability) => capability.label),
      ["Checkbox", "row 1: Ada — Checkbox", "row 2: Grace — Checkbox"],
    )

    await tree.unmount()
  })

  test(`[${base}] table: agent={false} leaves row controls as roots with no owner`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: false },
        React.createElement(
          mod.TableHeader,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableHead, null, "Name"),
          ),
        ),
        React.createElement(
          mod.TableBody,
          null,
          React.createElement(
            mod.TableRow,
            null,
            React.createElement(mod.TableCell, null, React.createElement(checkbox.Checkbox)),
            React.createElement(mod.TableCell, null, "Ada"),
          ),
        ),
      ),
    )

    // The table registered nothing and the checkbox is a root: no owner. Its
    // label still names its row — row naming belongs to the body, not to the
    // table's capability.
    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        kind: capability.kind,
        label: capability.label,
        owner: capability.owner,
      })),
      [{ kind: "checkbox", label: "row 1: Ada — Checkbox", owner: undefined }],
    )

    await tree.unmount()
  })

  test(`[${base}] checkbox: outside any container it is a root with its plain label`, async () => {
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const tree = await mount(React.createElement(checkbox.Checkbox))

    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        kind: capability.kind,
        label: capability.label,
        owner: capability.owner,
      })),
      [{ kind: "checkbox", label: "Checkbox", owner: undefined }],
    )

    await tree.unmount()
  })
}

/**
 * `required` is a constraint the application declares on the primitive. A
 * contract that forwards it to the picker without reporting or enforcing it
 * lets an agent clear a selection the application said could not be empty —
 * so the constraint is part of the capability, in both bases alike.
 */
function RequiredCalendarHost(props: {
  mod: ComponentModule
  id: string
  required: boolean
}) {
  const { mod, id, required } = props
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 2, 10),
  )
  return props.mod.Calendar
    ? React.createElement(mod.Calendar, {
        agent: { id },
        mode: "single",
        ...(required ? { required: true } : {}),
        selected,
        onSelect: setSelected,
      })
    : React.createElement("div")
}

for (const base of BASES) {
  test(`[${base}] calendar: a required calendar reports it in its read state`, async () => {
    const mod = modules.get(`${base}/calendar`)
    assert.ok(mod, `the ${base} calendar module must load`)
    const id = `${base}-calendar-required-read`
    const tree = await mount(
      React.createElement(RequiredCalendarHost, { mod, id, required: true }),
    )

    assert.deepEqual(registry.read(id), {
      mode: "single",
      required: true,
      value: ["2026-03-10"],
      min: null,
      max: null,
    })

    await tree.unmount()
  })

  test(`[${base}] calendar: a required calendar refuses an empty selection and keeps its value`, async () => {
    const mod = modules.get(`${base}/calendar`)
    assert.ok(mod, `the ${base} calendar module must load`)
    const id = `${base}-calendar-required-refuse`
    const tree = await mount(
      React.createElement(RequiredCalendarHost, { mod, id, required: true }),
    )

    // Outside `withAct`, exactly like every other tool call in this file: an
    // action's result is read after the application commits, and `act` defers
    // that commit to the end of its own scope, so a call wrapped in it would
    // be answered with pre-transition state.
    const output = JSON.parse(
      await tool("date_set").execute({ target: id, value: [] }),
    )
    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.match(output.error.message, /requires a selection/)
    assert.deepEqual(registry.read(id).value, ["2026-03-10"])

    await tree.unmount()
  })

  test(`[${base}] calendar: a calendar that does not require a selection is still cleared by an empty one`, async () => {
    const mod = modules.get(`${base}/calendar`)
    assert.ok(mod, `the ${base} calendar module must load`)
    const id = `${base}-calendar-optional-clear`
    const tree = await mount(
      React.createElement(RequiredCalendarHost, { mod, id, required: false }),
    )

    const output = JSON.parse(
      await tool("date_set").execute({ target: id, value: [] }),
    )
    assert.equal(output.ok, true)
    assert.deepEqual(output.state.value, [])
    assert.equal(output.state.required, false)

    await tree.unmount()
  })
}

/**
 * A composite's internal controls belong to the composite's capability. The
 * data table already exposes selection as `select_rows`, addressing rows by
 * id; if its per-row checkboxes registered too, every discovery call would
 * return one anonymous `checkbox` per visible row and an agent would have to
 * pick through them to find the page's real elements.
 */
for (const base of BASES) {
  test(`[${base}] data-table: row selection checkboxes register no capability of their own`, async () => {
    const mod = modules.get(`${base}/data-table`)
    assert.ok(mod, `the ${base} data-table module must load`)
    const id = `${base}-data-table-selection-noise`
    const rows = [
      { id: "r1", name: "Ada" },
      { id: "r2", name: "Grace" },
      { id: "r3", name: "Alan" },
    ]
    const tree = await mount(
      React.createElement(mod.DataTable, {
        agent: { id, label: "People" },
        data: rows,
        columns: [{ id: "name", header: "Name", accessor: (r: (typeof rows)[number]) => r.name }],
        getRowId: (r: (typeof rows)[number]) => r.id,
        enableRowSelection: true,
      }),
    )

    // Three rows plus a header checkbox would be four extra capabilities.
    assert.deepEqual(
      registry.describeAll().map((c) => c.id),
      [id],
      "the table must be the only capability its subtree registers",
    )
    assert.deepEqual(
      createAgentTools(registry).map((c) => c.name).filter((n) => n.startsWith("checkbox")),
      [],
      "no checkbox tool may appear for a table's own selection controls",
    )

    await tree.unmount()
  })
}

/**
 * A disclosure container's root renders no DOM element of its own and its
 * content is unmounted while closed, so the trigger is the only part that is
 * always mounted and always carries the human-meaningful name. The container
 * takes its label from the trigger's accessible name; an explicit
 * `agent.label` still wins, and a trigger with no resolvable name keeps the
 * generic fallback.
 */
interface TriggerLabelCaseDef {
  component: string
  /** The label the container reports when its trigger names nothing. */
  generic: string
  mount: (
    mod: ComponentModule,
    rootProps: AnyProps,
    triggerProps: AnyProps,
  ) => React.ReactElement
}

const TRIGGER_LABEL_CASES: readonly TriggerLabelCaseDef[] = [
  {
    component: "collapsible",
    generic: "Collapsible",
    mount: (mod, rootProps, triggerProps) =>
      React.createElement(
        mod.Collapsible,
        rootProps,
        React.createElement(mod.CollapsibleTrigger, triggerProps),
        React.createElement(mod.CollapsibleContent, null, "details"),
      ),
  },
  {
    component: "popover",
    generic: "Popover",
    mount: (mod, rootProps, triggerProps) =>
      React.createElement(
        mod.Popover,
        rootProps,
        React.createElement(mod.PopoverTrigger, triggerProps),
        React.createElement(mod.PopoverContent, null, "popover body"),
      ),
  },
  {
    component: "dropdown-menu",
    generic: "Dropdown menu",
    mount: (mod, rootProps, triggerProps) =>
      React.createElement(
        mod.DropdownMenu,
        rootProps,
        React.createElement(mod.DropdownMenuTrigger, triggerProps),
        React.createElement(
          mod.DropdownMenuContent,
          null,
          React.createElement(mod.DropdownMenuItem, null, "Cut"),
        ),
      ),
  },
]

for (const base of BASES) {
  for (const def of TRIGGER_LABEL_CASES) {
    test(`[${base}] ${def.component}: a closed container takes its label from its trigger`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const id = `${base}-${def.component}-trigger-label`
      const tree = await mount(
        def.mount(mod, { agent: { id } }, { children: "Toggle theme" }),
      )

      // Outside `act`, like every read in this file: the label is resolved
      // from the committed DOM and reported from the trigger's effect.
      assert.deepEqual(
        registry.describeAll().map((capability) => ({
          id: capability.id,
          label: capability.label,
        })),
        [{ id, label: "Toggle theme" }],
      )

      await tree.unmount()
    })

    test(`[${base}] ${def.component}: the trigger's aria-label wins over its visible text`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const id = `${base}-${def.component}-trigger-aria-label`
      const tree = await mount(
        def.mount(
          mod,
          { agent: { id } },
          { "aria-label": "Row actions", children: "Toggle theme" },
        ),
      )

      assert.deepEqual(
        registry.describeAll().map((capability) => ({
          id: capability.id,
          label: capability.label,
        })),
        [{ id, label: "Row actions" }],
      )

      await tree.unmount()
    })

    test(`[${base}] ${def.component}: a trigger with no resolvable name keeps the generic label`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const id = `${base}-${def.component}-trigger-unnamed`
      // An icon-only trigger carries no text, no aria-label and no label
      // association.
      const tree = await mount(
        def.mount(mod, { agent: { id } }, { children: React.createElement("svg") }),
      )

      assert.deepEqual(
        registry.describeAll().map((capability) => ({
          id: capability.id,
          label: capability.label,
        })),
        [{ id, label: def.generic }],
      )

      await tree.unmount()
    })

    test(`[${base}] ${def.component}: an explicit agent label beats the trigger's name`, async () => {
      const mod = modules.get(`${base}/${def.component}`)
      assert.ok(mod, `the ${base} ${def.component} module must load`)
      const id = `${base}-${def.component}-trigger-explicit-label`
      const tree = await mount(
        def.mount(
          mod,
          { agent: { id, label: "Explicit" } },
          { children: "Toggle theme" },
        ),
      )

      assert.deepEqual(
        registry.describeAll().map((capability) => ({
          id: capability.id,
          label: capability.label,
        })),
        [{ id, label: "Explicit" }],
      )

      await tree.unmount()
    })
  }
}

/**
 * Chart is the page's other mass of content: its numbers are geometry in an
 * SVG, so no text walk can ever see them. The capability reads the `data`
 * prop off the single recharts child instead — the rows the application
 * passed in are the same rows the bars render. The reads below sit outside
 * `act`, exactly like every read in this file.
 */
for (const base of BASES) {
  test(`[${base}] chart: registers one content capability that reads series and data`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/chart`)) as ComponentModule
    const { BarChart } = await import("recharts")
    const id = `${base}-chart-content`
    const rows = [
      { month: "January", desktop: 186, mobile: 80 },
      { month: "February", desktop: 305, mobile: 200 },
      { month: "March", desktop: 237, mobile: 120 },
    ]
    const tree = await mount(
      React.createElement(
        mod.ChartContainer,
        {
          agent: { id },
          config: {
            desktop: { label: "Desktop" },
            mobile: { label: "Mobile" },
          },
        },
        React.createElement(BarChart, { data: rows }),
      ),
    )

    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        label: capability.label,
        actions: capability.actions,
      })),
      [{ id, kind: "content", label: "Chart", actions: [] }],
    )
    assert.deepEqual(registry.read(id), {
      series: [
        { key: "desktop", label: "Desktop" },
        { key: "mobile", label: "Mobile" },
      ],
      data: rows,
      rowCount: 3,
    })

    await tree.unmount()
  })

  test(`[${base}] chart: a series key with no label falls back to the key`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/chart`)) as ComponentModule
    const { BarChart } = await import("recharts")
    const id = `${base}-chart-series-fallback`
    const tree = await mount(
      React.createElement(
        mod.ChartContainer,
        {
          agent: { id },
          config: {
            desktop: {},
            mobile: { label: "Mobile" },
          },
        },
        React.createElement(BarChart, { data: [{ month: "January" }] }),
      ),
    )

    assert.deepEqual(
      (registry.read(id) as { series: { key: string; label: string }[] })
        .series,
      [
        { key: "desktop", label: "desktop" },
        { key: "mobile", label: "Mobile" },
      ],
    )

    await tree.unmount()
  })

  test(`[${base}] chart: children that are not one element with a data array read as null`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/chart`)) as ComponentModule
    const id = `${base}-chart-no-data`
    const config = { desktop: { label: "Desktop" } }

    // A child that is not an element at all.
    const textTree = await mount(
      React.createElement(
        mod.ChartContainer,
        { agent: { id }, config },
        "not a chart",
      ),
    )
    assert.deepEqual(registry.read(id), {
      series: [{ key: "desktop", label: "Desktop" }],
      data: null,
      rowCount: 0,
    })
    await textTree.unmount()

    // An element that carries no `data` array.
    const elementTree = await mount(
      React.createElement(
        mod.ChartContainer,
        { agent: { id }, config },
        React.createElement("div"),
      ),
    )
    assert.deepEqual(registry.read(id), {
      series: [{ key: "desktop", label: "Desktop" }],
      data: null,
      rowCount: 0,
    })
    await elementTree.unmount()
  })

  test(`[${base}] chart: agent={false} registers nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/chart`)) as ComponentModule
    const { BarChart } = await import("recharts")
    const tree = await mount(
      React.createElement(
        mod.ChartContainer,
        {
          agent: false,
          config: { desktop: { label: "Desktop" } },
        },
        React.createElement(BarChart, { data: [{ month: "January" }] }),
      ),
    )

    assert.deepEqual(registry.describeAll(), [])

    await tree.unmount()
  })

  test(`[${base}] calendar: a month of day cells adds no button capabilities`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/calendar`)) as ComponentModule
    const id = `${base}-calendar-day-noise`
    const tree = await mount(
      React.createElement(mod.Calendar, {
        agent: { id },
        mode: "single",
        defaultMonth: new Date(2026, 6, 1),
      }),
    )

    // A month renders about forty day buttons. `date` addresses a day by its
    // date; forty anonymous buttons would be a worse interface for the same
    // act, so the calendar must stay the only capability its subtree registers.
    assert.deepEqual(
      registry.describeAll().map((capability) => capability.kind),
      ["date"],
    )

    await tree.unmount()
  })

  test(`[${base}] dialog: the built-in close button is not a second way to close`, async () => {
    const mod = modules.get(`${base}/dialog`)
    assert.ok(mod, `the ${base} dialog module must load`)
    const id = `${base}-dialog-close-noise`
    const tree = await mount(
      React.createElement(
        mod.Dialog,
        { agent: { id }, defaultOpen: true },
        React.createElement(
          mod.DialogContent,
          null,
          React.createElement(mod.DialogTitle, null, "Confirm"),
        ),
      ),
    )

    // The dialog capability already has a `close` action.
    assert.deepEqual(
      registry.describeAll().map((capability) => capability.kind),
      ["dialog"],
    )

    await tree.unmount()
  })
}

/**
 * The command palette is the page's search box and its pressable list: the
 * search is the same `input` capability every text box carries, the items
 * are `button` capabilities owned by the palette, and the palette's own
 * content read reports the search string, how many items the filter left
 * mounted, and the empty text. The reads and tool calls below sit outside
 * `act`, exactly like every tool call in this file: a read is answered from
 * the committed DOM, and wrapping one in `act` would defer that commit and
 * answer with pre-transition state.
 *
 * `settle` waits out one extra hop the palette has and other components do
 * not: the search value commits with the input, and cmdk syncs its store
 * from the committed value in a passive effect, so the filtered item list
 * lands one render after the tool has reported the input's new state. A real
 * agent's next tool call arrives in a later message and always sees the
 * settled list; the test waits the same way.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

for (const base of BASES) {
  test(`[${base}] command: a palette registers its content, its input and its items, all owned by the palette`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const id = `${base}-command-palette`
    const tree = await mount(
      React.createElement(
        mod.Command,
        { agent: { id } },
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(mod.CommandEmpty, null, "No results."),
          React.createElement(mod.CommandItem, null, "Northwind Traders"),
          React.createElement(mod.CommandItem, null, "Adventure Works"),
          React.createElement(
            mod.CommandItem,
            { disabled: true },
            "Archived Depot",
          ),
        ),
      ),
    )

    assert.deepEqual(
      registry
        .describeAll()
        .map((capability) => ({
          kind: capability.kind,
          label: capability.label,
          owner: capability.owner,
        }))
        .sort((a, b) => (a.kind + a.label).localeCompare(b.kind + b.label)),
      [
        { kind: "button", label: "Adventure Works", owner: id },
        { kind: "button", label: "Archived Depot", owner: id },
        { kind: "button", label: "Northwind Traders", owner: id },
        { kind: "content", label: "Command palette", owner: undefined },
        { kind: "input", label: "Command input", owner: id },
      ],
    )

    await tree.unmount()
  })

  test(`[${base}] command: input_set_value filters the list to the matching item`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const id = `${base}-command-filter`
    const tree = await mount(
      React.createElement(
        mod.Command,
        { agent: { id } },
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(mod.CommandEmpty, null, "No results."),
          React.createElement(mod.CommandItem, null, "Northwind Traders"),
          React.createElement(mod.CommandItem, null, "Adventure Works"),
          React.createElement(mod.CommandItem, null, "Archived Depot"),
        ),
      ),
    )

    const palette = registry
      .describeAll()
      .find((capability) => capability.kind === "content")
    const input = registry
      .describeAll()
      .find((capability) => capability.kind === "input")
    assert.ok(palette && input, "the palette and its input must register")

    await tool("input_set_value").execute({ target: input.id, value: "northwind" })
    await settle()

    // A filtered-out item is unmounted, so it registers nothing: listing the
    // palette shows exactly the matches.
    assert.deepEqual(
      registry
        .describeAll()
        .filter((capability) => capability.kind === "button")
        .map((capability) => capability.label),
      ["Northwind Traders"],
    )
    assert.deepEqual(registry.read(palette.id), {
      search: "northwind",
      itemCount: 1,
      emptyText: null,
    })

    await tree.unmount()
  })

  test(`[${base}] command: a term matching nothing leaves no items and reports the empty text`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const id = `${base}-command-no-match`
    const tree = await mount(
      React.createElement(
        mod.Command,
        { agent: { id } },
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(mod.CommandEmpty, null, "No results."),
          React.createElement(mod.CommandItem, null, "Northwind Traders"),
          React.createElement(mod.CommandItem, null, "Adventure Works"),
          React.createElement(mod.CommandItem, null, "Archived Depot"),
        ),
      ),
    )

    const palette = registry
      .describeAll()
      .find((capability) => capability.kind === "content")
    const input = registry
      .describeAll()
      .find((capability) => capability.kind === "input")
    assert.ok(palette && input, "the palette and its input must register")

    await tool("input_set_value").execute({ target: input.id, value: "zzz" })
    await settle()

    assert.deepEqual(
      registry.describeAll().filter((capability) => capability.kind === "button"),
      [],
    )
    assert.deepEqual(registry.read(palette.id), {
      search: "zzz",
      itemCount: 0,
      emptyText: "No results.",
    })

    await tree.unmount()
  })

  test(`[${base}] command: button_press on an item fires that item's onSelect`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Command,
        null,
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(
            mod.CommandItem,
            { onSelect: () => seen.push("northwind") },
            "Northwind Traders",
          ),
          React.createElement(
            mod.CommandItem,
            { onSelect: () => seen.push("adventure") },
            "Adventure Works",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find(
        (capability) =>
          capability.kind === "button" && capability.label === "Northwind Traders",
      )
    assert.ok(item, "the palette's items must register as pressable buttons")

    await tool("button_press").execute({ target: item.id })

    assert.deepEqual(seen, ["northwind"])

    await tree.unmount()
  })

  test(`[${base}] command: pressing a disabled item is rejected naming the item and runs nothing`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Command,
        null,
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(
            mod.CommandItem,
            { onSelect: () => seen.push("northwind") },
            "Northwind Traders",
          ),
          React.createElement(
            mod.CommandItem,
            { disabled: true, onSelect: () => seen.push("archived") },
            "Archived Depot",
          ),
        ),
      ),
    )

    const item = registry
      .describeAll()
      .find(
        (capability) =>
          capability.kind === "button" && capability.label === "Archived Depot",
      )
    assert.ok(item, "the disabled item must register as a pressable button")

    const output = JSON.parse(await tool("button_press").execute({ target: item.id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.equal(
      output.error.message,
      '"Archived Depot" is disabled and cannot be pressed right now.',
    )
    assert.deepEqual(
      seen,
      [],
      "a disabled item must never run the application's handler",
    )

    await tree.unmount()
  })

  test(`[${base}] command: agent={false} on the palette registers nothing for the palette itself`, async () => {
    const mod = modules.get(`${base}/command`)
    assert.ok(mod, `the ${base} command module must load`)
    const tree = await mount(
      React.createElement(
        mod.Command,
        { agent: false },
        React.createElement(mod.CommandInput, null),
        React.createElement(
          mod.CommandList,
          null,
          React.createElement(mod.CommandItem, null, "Northwind Traders"),
        ),
      ),
    )

    // The palette itself registers nothing; its input and item carry their
    // own agent props, so they register as roots with no owner.
    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        kind: capability.kind,
        owner: capability.owner,
      })),
      [
        { kind: "input", owner: undefined },
        { kind: "button", owner: undefined },
      ],
    )

    await tree.unmount()
  })
}

/**
 * The acceptance criterion for agent-facing identity: an element's id is an
 * address an agent plans against, so it must survive the tree changing around
 * it. Both tests mount a table whose capabilities have no explicit ids —
 * identity is derived from what they can say about themselves — and are
 * written against the strongest form of each disturbance: the sibling test
 * keys the table so the re-render REMOUNTS it with fresh React seeds, which
 * is what a position-derived id could never survive.
 *
 * The renders sit inside `act`; the reads sit outside it, like every read in
 * this file.
 */
for (const base of BASES) {
  test(`[${base}] table: every capability id survives a re-render that changes the tree above it`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule

    function Host({ sibling }: { sibling: boolean }) {
      return React.createElement(
        "div",
        null,
        sibling ? React.createElement("p", null, "A section above") : null,
        React.createElement(
          mod.Table,
          // The key moves with the sibling so the re-render remounts the
          // table — new React seeds, new fibers — the strongest form of
          // "the tree above it changed".
          { key: sibling ? "shifted" : "alone" },
          React.createElement(
            mod.TableHeader,
            null,
            React.createElement(
              mod.TableRow,
              null,
              React.createElement(mod.TableHead, null, "Name"),
              React.createElement(mod.TableHead, null, "Email"),
            ),
          ),
          React.createElement(
            mod.TableBody,
            null,
            React.createElement(
              mod.TableRow,
              null,
              React.createElement(
                mod.TableCell,
                null,
                React.createElement(checkbox.Checkbox),
              ),
              React.createElement(mod.TableCell, null, "Ada"),
              React.createElement(mod.TableCell, null, "ada@lovelace.dev"),
            ),
            React.createElement(
              mod.TableRow,
              null,
              React.createElement(
                mod.TableCell,
                null,
                React.createElement(checkbox.Checkbox),
              ),
              React.createElement(mod.TableCell, null, "Grace"),
              React.createElement(mod.TableCell, null, "grace@example.com"),
            ),
          ),
        ),
      )
    }

    const container = dom.window.document.createElement("div")
    dom.window.document.body.appendChild(container)
    const root = createRoot(container)
    await withAct(async () => {
      root.render(React.createElement(Host, { sibling: false }))
    })

    // Identity is content-derived: the table by its kind and label, each row
    // control by its row's first meaningful cell text.
    const before = registry.describeAll().map((capability) => capability.id).sort()
    assert.deepEqual(before, [
      "content.table",
      "content.table.checkbox.ada-checkbox",
      "content.table.checkbox.grace-checkbox",
    ])

    await withAct(async () => {
      root.render(React.createElement(Host, { sibling: true }))
    })

    assert.deepEqual(
      registry.describeAll().map((capability) => capability.id).sort(),
      before,
      "a re-render that changes the tree above the table must move no id",
    )

    await withAct(async () => {
      root.unmount()
    })
    container.remove()
  })

  test(`[${base}] table: re-sorting the rows keeps a row control's id while its label's row number changes`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule

    function Host({ rows }: { rows: readonly [string, string][] }) {
      return React.createElement(
        mod.Table,
        null,
        React.createElement(
          mod.TableBody,
          null,
          rows.map(([name, email]) =>
            React.createElement(
              mod.TableRow,
              { key: name },
              React.createElement(
                mod.TableCell,
                null,
                React.createElement(checkbox.Checkbox),
              ),
              React.createElement(mod.TableCell, null, name),
              React.createElement(mod.TableCell, null, email),
            ),
          ),
        ),
      )
    }

    const container = dom.window.document.createElement("div")
    dom.window.document.body.appendChild(container)
    const root = createRoot(container)
    await withAct(async () => {
      root.render(
        React.createElement(Host, {
          rows: [
            ["Ada", "ada@lovelace.dev"],
            ["Grace", "grace@example.com"],
          ],
        }),
      )
    })

    // The row control is addressed by id, not by its position: the id is
    // derived from the row's name, the label carries the row number for
    // display.
    const adaId = "content.table.checkbox.ada-checkbox"
    const ada = registry.get(adaId)
    assert.ok(ada, "the Ada row's checkbox must register under its row's name")
    assert.equal(ada.label, "row 1: Ada — Checkbox")

    await withAct(async () => {
      root.render(
        React.createElement(Host, {
          rows: [
            ["Grace", "grace@example.com"],
            ["Ada", "ada@lovelace.dev"],
          ],
        }),
      )
    })

    const moved = registry.get(adaId)
    assert.ok(moved, "the same control keeps its id across the sort")
    assert.equal(
      moved.label,
      "row 2: Ada — Checkbox",
      "the label follows the row's new position",
    )

    await withAct(async () => {
      root.unmount()
    })
    container.remove()
  })
}

/**
 * A disclosure container owns the content it opens. Popover and dialog
 * content mounts only while the container is open, and every capability
 * that content registers belongs to the container that opened it: a filter
 * popover's options must be its children, not anonymous roots that reuse
 * the base id of every other palette on the page. Ownership is what lets an
 * agent open `disclosure.status` and ask it for its children.
 *
 * The tool calls sit outside `act`, exactly like every tool call in this
 * file: opening commits the content's mount, and the content's capabilities
 * register from that commit, so wrapping the call would answer with
 * pre-transition state.
 */
for (const base of BASES) {
  test(`[${base}] popover: a closed popover has no children; opening it reveals its content, each owned by the popover`, async () => {
    const mod = modules.get(`${base}/popover`)
    assert.ok(mod, `the ${base} popover module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const id = `${base}-popover-owned-content`
    const tree = await mount(
      React.createElement(
        mod.Popover,
        { agent: { id } },
        React.createElement(mod.PopoverTrigger, null, "Filter status"),
        React.createElement(
          mod.PopoverContent,
          null,
          React.createElement(checkbox.Checkbox),
        ),
      ),
    )

    // The content is unmounted while closed, so the popover honestly lists
    // no children.
    const closed = JSON.parse(await tool("ui_list").execute({ target: id }))
    assert.deepEqual(closed.elements, [])

    await tool("disclosure_open").execute({ target: id })

    const listed = JSON.parse(await tool("ui_list").execute({ target: id }))
    assert.deepEqual(
      listed.elements.map((element: { kind: string; label?: string }) => ({
        kind: element.kind,
        label: element.label,
      })),
      [{ kind: "checkbox", label: "Checkbox" }],
    )

    const control = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(control, "the popover's content must register a capability")
    assert.equal(
      control.owner,
      id,
      "the content's capability must be owned by the popover",
    )
    assert.equal(control.id, listed.elements[0].id)

    await tree.unmount()
  })

  test(`[${base}] dialog: content registered inside it carries the dialog as its owner`, async () => {
    const mod = modules.get(`${base}/dialog`)
    assert.ok(mod, `the ${base} dialog module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const id = `${base}-dialog-owned-content`
    const tree = await mount(
      React.createElement(
        mod.Dialog,
        { agent: { id } },
        React.createElement(mod.DialogTrigger, null, "Open"),
        React.createElement(
          mod.DialogContent,
          null,
          React.createElement(mod.DialogTitle, null, "Confirm"),
          React.createElement(checkbox.Checkbox),
        ),
      ),
    )

    const closed = JSON.parse(await tool("ui_list").execute({ target: id }))
    assert.deepEqual(closed.elements, [])

    await tool("dialog_open").execute({ target: id })

    const listed = JSON.parse(await tool("ui_list").execute({ target: id }))
    assert.deepEqual(
      listed.elements.map((element: { kind: string; label?: string }) => ({
        kind: element.kind,
        label: element.label,
      })),
      [{ kind: "checkbox", label: "Checkbox" }],
    )

    const control = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(control, "the dialog's content must register a capability")
    assert.equal(control.owner, id, "the content must be owned by the dialog")
    assert.equal(control.id, listed.elements[0].id)

    await tree.unmount()
  })

  test(`[${base}] popover: agent={false} leaves its content as roots with no owner`, async () => {
    const mod = modules.get(`${base}/popover`)
    assert.ok(mod, `the ${base} popover module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const tree = await mount(
      React.createElement(
        mod.Popover,
        { agent: false, defaultOpen: true },
        React.createElement(mod.PopoverTrigger, null, "Filter status"),
        React.createElement(
          mod.PopoverContent,
          null,
          React.createElement(checkbox.Checkbox),
        ),
      ),
    )

    // The popover registered nothing, and its provider passes `ownerId:
    // undefined`, so the content is a root: no owner.
    assert.deepEqual(
      registry.describeAll().map((capability) => ({
        kind: capability.kind,
        owner: capability.owner,
      })),
      [{ kind: "checkbox", owner: undefined }],
    )

    await tree.unmount()
  })

  test(`[${base}] popover: two popovers holding a same-named control give it different ids because its owner differs`, async () => {
    const mod = modules.get(`${base}/popover`)
    assert.ok(mod, `the ${base} popover module must load`)
    const checkbox = (await import(`../src/bases/${base}/ui/checkbox`)) as ComponentModule
    const firstId = `${base}-popover-a`
    const secondId = `${base}-popover-b`
    const tree = await mount(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          mod.Popover,
          { agent: { id: firstId } },
          React.createElement(mod.PopoverTrigger, null, "First"),
          React.createElement(
            mod.PopoverContent,
            null,
            React.createElement(checkbox.Checkbox),
          ),
        ),
        React.createElement(
          mod.Popover,
          { agent: { id: secondId } },
          React.createElement(mod.PopoverTrigger, null, "Second"),
          React.createElement(
            mod.PopoverContent,
            null,
            React.createElement(checkbox.Checkbox),
          ),
        ),
      ),
    )

    // Open one popover at a time, as an agent would: each content's control
    // registers scoped by the popover that owns it. Its identity is taken
    // while its own popover is the one open — opening one popover's content
    // can replace the other's on screen, so a control's registration is not
    // guaranteed to outlive its container's replacement.
    await tool("disclosure_open").execute({ target: firstId })
    const first = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(first, "the first popover's content must register a checkbox")
    assert.equal(first.label, "Checkbox")
    assert.equal(first.owner, firstId)
    assert.equal(first.id, `${first.owner}.checkbox.checkbox`)

    await tool("disclosure_close").execute({ target: firstId })
    await tool("disclosure_open").execute({ target: secondId })
    const second = registry
      .describeAll()
      .find((capability) => capability.kind === "checkbox")
    assert.ok(second, "the second popover's content must register a checkbox")
    assert.equal(second.label, "Checkbox")
    assert.equal(second.owner, secondId)
    assert.equal(second.id, `${second.owner}.checkbox.checkbox`)

    // Same kind, same label — only the scoping owner can tell them apart.
    // An id that ignored the owner would hand the second control the first
    // one's address; ownership scoping is what keeps the two ids distinct.
    assert.notEqual(
      first.id,
      second.id,
      "same-named controls in different owners must not share an id",
    )

    await tree.unmount()
  })
}

/**
 * The toaster is how the application says "this worked": a content
 * capability reporting the notifications it raised. `recent` is why an
 * agent can trust the answer — a toast disappears in seconds, so reporting
 * only what is on screen would make the answer depend on when the read
 * lands.
 *
 * sonner's `toast()` does render in jsdom, but it drives its own lifecycle
 * with timers — a toast is inserted, auto-dismissed and removed on a clock —
 * so a case driven through it would assert a race with sonner's timers,
 * which is exactly the timing dependence this capability exists to remove.
 * These cases therefore drive the parts this change adds — the observer
 * and the reader — against toast markup that matches the exact contract
 * the toaster renders (`[data-sonner-toast]` carrying `[data-title]`,
 * `[data-description]` and `data-type`) and append it to the container
 * sonner rendered. `visible` is pulled from the DOM at read time; the
 * observer is what moves a toast into `recent`. The mutations sit inside
 * `act` — a MutationObserver delivers on a microtask, which the `act` await
 * settles — and the reads sit outside it, exactly like every read in this
 * file.
 */

/** A toast as sonner renders it: the parts this task reads. */
function toastElement(options: {
  title: string
  description?: string
  type?: string
}): HTMLElement {
  const toast = dom.window.document.createElement("li")
  toast.setAttribute("data-sonner-toast", "")
  if (options.type !== undefined) toast.setAttribute("data-type", options.type)
  const title = dom.window.document.createElement("div")
  title.setAttribute("data-title", "")
  title.textContent = options.title
  toast.appendChild(title)
  if (options.description !== undefined) {
    const description = dom.window.document.createElement("div")
    description.setAttribute("data-description", "")
    description.textContent = options.description
    toast.appendChild(description)
  }
  return toast
}

/** The container the toaster renders and observes. */
function toasterContainer(): HTMLElement {
  const container = dom.window.document.querySelector('[aria-live="polite"]')
  assert.ok(container, "the toaster must render its container")
  return container as HTMLElement
}

for (const base of BASES) {
  test(`[${base}] toaster: a toast raised after mount appears in visible with its title and description`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/sonner`)) as ComponentModule
    const id = `${base}-toaster-visible`
    const tree = await mount(
      React.createElement(mod.Toaster, { agent: { id } }),
    )

    await withAct(async () => {
      toasterContainer().appendChild(
        toastElement({
          title: "Invite sent",
          description: "ada@lovelace.dev",
          type: "success",
        }),
      )
    })

    const state = registry.read(id) as {
      visible: { title: string; description: string | null; kind: string; at: string }[]
      recent: { title: string; description: string | null; kind: string; at: string }[]
    }
    assert.equal(state.visible.length, 1)
    assert.deepEqual(
      state.visible.map((toast) => ({
        title: toast.title,
        description: toast.description,
        kind: toast.kind,
      })),
      [{ title: "Invite sent", description: "ada@lovelace.dev", kind: "success" }],
    )
    // A toast that is still visible appears in both lists, with the same `at`.
    assert.deepEqual(state.recent, state.visible)

    await tree.unmount()
  })

  test(`[${base}] toaster: a toast removed from the DOM leaves visible but stays in recent`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/sonner`)) as ComponentModule
    const id = `${base}-toaster-recent`
    const tree = await mount(
      React.createElement(mod.Toaster, { agent: { id } }),
    )

    const toast = toastElement({ title: "Invite sent", type: "error" })
    await withAct(async () => {
      toasterContainer().appendChild(toast)
    })
    await withAct(async () => {
      toast.remove()
    })

    const state = registry.read(id) as {
      visible: { title: string }[]
      recent: { title: string; kind: string }[]
    }
    assert.deepEqual(state.visible, [])
    assert.deepEqual(
      state.recent.map((entry) => ({ title: entry.title, kind: entry.kind })),
      [{ title: "Invite sent", kind: "error" }],
    )

    await tree.unmount()
  })

  test(`[${base}] toaster: the recent log holds at most 20 entries, keeping the newest`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/sonner`)) as ComponentModule
    const id = `${base}-toaster-bound`
    const tree = await mount(
      React.createElement(mod.Toaster, { agent: { id } }),
    )

    await withAct(async () => {
      const container = toasterContainer()
      for (let index = 1; index <= 25; index += 1) {
        container.appendChild(toastElement({ title: `toast ${index}` }))
      }
    })

    const state = registry.read(id) as {
      visible: { title: string }[]
      recent: { title: string }[]
    }
    assert.equal(state.recent.length, 20, "the log must never exceed its bound")
    assert.equal(state.recent[0].title, "toast 6", "the oldest entries must be dropped")
    assert.equal(state.recent[state.recent.length - 1].title, "toast 25")
    // `visible` is the DOM's truth at read time, uncapped; the bound is the
    // log's, so an agent reading after the fact still sees the newest 20.
    assert.equal(state.visible.length, 25)

    await tree.unmount()
  })

  test(`[${base}] toaster: a toast with no description reports description: null, not a missing key`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/sonner`)) as ComponentModule
    const id = `${base}-toaster-no-description`
    const tree = await mount(
      React.createElement(mod.Toaster, { agent: { id } }),
    )

    await withAct(async () => {
      toasterContainer().appendChild(toastElement({ title: "Just a title" }))
    })

    const state = registry.read(id) as {
      visible: { title: string; description: string | null; kind: string; at: string }[]
    }
    assert.equal(state.visible.length, 1)
    assert.equal(state.visible[0].title, "Just a title")
    assert.ok("description" in state.visible[0], "the key must be present")
    assert.equal(state.visible[0].description, null)
    // No `data-type` on the element: the kind falls back to "message".
    assert.equal(state.visible[0].kind, "message")
    assert.match(state.visible[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

    await tree.unmount()
  })

  test(`[${base}] toaster: agent={false} registers nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/sonner`)) as ComponentModule
    const tree = await mount(
      React.createElement(mod.Toaster, { agent: false }),
    )

    assert.deepEqual(registry.describeAll(), [])

    await tree.unmount()
  })
}

/**
 * A press must be the press a person makes: focus, then the full
 * pointer/mouse sequence ending in click. A bare `element.click()` dispatches
 * one click event, and a menu trigger never sees it — Radix opens its menus
 * on `pointerdown` — so a press reported as success would have done nothing.
 * These cases pin the press spelling through the tools, on both bases.
 */
for (const base of BASES) {
  test(`[${base}] button: button_press on a dropdown menu's trigger opens the menu — a press the trigger does not see is a success that did nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const menu = (await import(`../src/bases/${base}/ui/dropdown-menu`)) as ComponentModule
    const id = `${base}-menu-trigger-press`
    const tree = await mount(
      React.createElement(
        menu.DropdownMenu,
        { agent: { id } },
        React.createElement(
          menu.DropdownMenuTrigger,
          null,
          React.createElement(mod.Button, null, "Priority"),
        ),
        React.createElement(
          menu.DropdownMenuContent,
          null,
          React.createElement(menu.DropdownMenuItem, null, "Sort ascending"),
        ),
      ),
    )

    const button = registry
      .describeAll()
      .find((capability) => capability.kind === "button")
    assert.ok(button, "the trigger's button must register a capability")

    await tool("button_press").execute({ target: button.id })

    // Read outside `act`, exactly like every tool call in this file.
    const output = JSON.parse(await tool("ui_read").execute({ target: id }))
    assert.equal(output.ok, true)
    assert.equal(
      output.state.open,
      true,
      "the press must open the menu, as a person's press does",
    )

    await tree.unmount()
  })

  test(`[${base}] button: a press fires the button's onClick exactly once`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-press-once`
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Button,
        { agent: { id }, onClick: () => seen.push("click") },
        "Save changes",
      ),
    )

    await tool("button_press").execute({ target: id })

    assert.deepEqual(
      seen,
      ["click"],
      "the press sequence already ends in click, so calling element.click() on top would run onClick twice",
    )

    await tree.unmount()
  })

  test(`[${base}] button: a press dispatches the events a person's press dispatches, pointerdown before click`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-press-order`
    const order: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Button,
        {
          agent: { id },
          onPointerDown: () => order.push("pointerdown"),
          onMouseDown: () => order.push("mousedown"),
          onPointerUp: () => order.push("pointerup"),
          onMouseUp: () => order.push("mouseup"),
          onClick: () => order.push("click"),
        },
        "Priority",
      ),
    )

    await tool("button_press").execute({ target: id })

    assert.deepEqual(
      order,
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"],
      "a press must dispatch the full sequence, in the order a person's press dispatches it",
    )

    await tree.unmount()
  })

  test(`[${base}] button: a press moves focus to the pressed element`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-press-focus`
    const tree = await mount(
      React.createElement(mod.Button, { agent: { id } }, "Priority"),
    )
    const element = tree.container.querySelector("button")
    assert.ok(element, "the button must render a button element")
    assert.notEqual(
      dom.window.document.activeElement,
      element,
      "precondition: the button starts unfocused",
    )

    await tool("button_press").execute({ target: id })

    assert.equal(
      dom.window.document.activeElement,
      element,
      "a press must move focus to the pressed element",
    )

    await tree.unmount()
  })

  test(`[${base}] button: a press on a disabled button is rejected and dispatches nothing`, async () => {
    const mod = (await import(`../src/bases/${base}/ui/button`)) as ComponentModule
    const id = `${base}-button-press-disabled`
    const seen: string[] = []
    const tree = await mount(
      React.createElement(
        mod.Button,
        {
          agent: { id },
          disabled: true,
          onPointerDown: () => seen.push("pointerdown"),
          onClick: () => seen.push("click"),
        },
        "Send Invitation",
      ),
    )

    const output = JSON.parse(await tool("button_press").execute({ target: id }))

    assert.equal(output.ok, false)
    assert.equal(output.error.code, "rejected")
    assert.deepEqual(seen, [], "a rejected press must dispatch nothing")

    await tree.unmount()
  })
}

/**
 * A table must not claim to know a total it cannot see. `renderedRowCount`
 * is what the DOM actually renders; `totalRowCount` is read only from
 * `aria-rowcount`, the ARIA attribute defined for exactly this — the total
 * including rows not currently in the DOM — and is `null` whenever the page
 * never stated one, or stated ARIA's "unknown". A DataTable states the real
 * total through that same attribute, from the same filtered row model its
 * capability read reports, so a screen reader and an agent see the same
 * total from the same source.
 *
 * Reads and tool calls sit outside `act`, exactly like every read in this
 * file.
 */
for (const base of BASES) {
  test(`[${base}] table: a plain table reports renderedRowCount and no totalRowCount`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const id = `${base}-table-total-absent`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id } },
        React.createElement(
          mod.TableBody,
          null,
          Array.from({ length: 3 }, (_, index) =>
            React.createElement(
              mod.TableRow,
              { key: index },
              React.createElement(mod.TableCell, null, `cell ${index}`),
            ),
          ),
        ),
      ),
    )

    // No page ever stated a total, so the table says so: `null`, not a
    // number an agent could mistake for the dataset size.
    assert.deepEqual(registry.read(id), {
      columns: [],
      rows: [{ col0: "cell 0" }, { col0: "cell 1" }, { col0: "cell 2" }],
      renderedRowCount: 3,
      totalRowCount: null,
    })

    await tree.unmount()
  })

  test(`[${base}] table: aria-rowcount is reported as totalRowCount`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const id = `${base}-table-total-500`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id }, "aria-rowcount": "500" },
        React.createElement(
          mod.TableBody,
          null,
          Array.from({ length: 3 }, (_, index) =>
            React.createElement(
              mod.TableRow,
              { key: index },
              React.createElement(mod.TableCell, null, `cell ${index}`),
            ),
          ),
        ),
      ),
    )

    assert.deepEqual(registry.read(id), {
      columns: [],
      rows: [{ col0: "cell 0" }, { col0: "cell 1" }, { col0: "cell 2" }],
      renderedRowCount: 3,
      totalRowCount: 500,
    })

    await tree.unmount()
  })

  test(`[${base}] table: aria-rowcount="-1" reports null, ARIA's unknown is not a total`, async () => {
    const mod = modules.get(`${base}/table`)
    assert.ok(mod, `the ${base} table module must load`)
    const id = `${base}-table-total-unknown`
    const tree = await mount(
      React.createElement(
        mod.Table,
        { agent: { id }, "aria-rowcount": "-1" },
        React.createElement(
          mod.TableBody,
          null,
          Array.from({ length: 3 }, (_, index) =>
            React.createElement(
              mod.TableRow,
              { key: index },
              React.createElement(mod.TableCell, null, `cell ${index}`),
            ),
          ),
        ),
      ),
    )

    const state = registry.read(id) as {
      renderedRowCount: number
      totalRowCount: number | null
    }
    assert.equal(state.renderedRowCount, 3)
    assert.equal(state.totalRowCount, null)

    await tree.unmount()
  })

  test(`[${base}] data-table: aria-rowcount tracks the filtered row total`, async () => {
    const mod = modules.get(`${base}/data-table`)
    assert.ok(mod, `the ${base} data-table module must load`)
    const id = `${base}-data-table-aria-total`
    const rows = [
      { id: "r1", name: "Ada" },
      { id: "r2", name: "Grace" },
      { id: "r3", name: "Alan" },
    ]
    const tree = await mount(
      React.createElement(mod.DataTable, {
        agent: { id },
        data: rows,
        columns: [
          { id: "name", header: "Name", accessor: (r: (typeof rows)[number]) => r.name },
        ],
        getRowId: (r: (typeof rows)[number]) => r.id,
        enableRowSelection: false,
      }),
    )

    const table = tree.container.querySelector("table")
    assert.ok(table, "the data table must render a table element")
    assert.equal(
      table.getAttribute("aria-rowcount"),
      "3",
      "the rendered table must state the filtered row total",
    )
    assert.equal(registry.read(id).rowCount, 3)

    // Outside `act`, like every tool call in this file: the filter commits
    // the narrowed row model, and the attribute is read from the committed
    // DOM.
    await tool("table_filter").execute({ target: id, column: "name", value: "Ada" })

    assert.equal(
      table.getAttribute("aria-rowcount"),
      "1",
      "a filter that narrows the rows must narrow the stated total",
    )
    assert.equal(registry.read(id).rowCount, 1)

    await tree.unmount()
  })

  test(`[${base}] card: content rendered inside a card belongs to that card`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const { AgentContent } = await import("../src/lib/agent-ui/agent-content")
    const cardId = `${base}-card-owns-content`
    const innerId = `${base}-card-inner-content`
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: { id: cardId } },
        React.createElement(mod.CardTitle, null, "Overview"),
        React.createElement(
          AgentContent,
          { agent: { id: innerId }, label: "Monthly revenue", value: [{ name: "Feb", total: 5764 }] },
          React.createElement("svg", null),
        ),
      ),
    )

    // A chart's numbers are geometry, so the card itself reads empty. Without
    // ownership an agent sees an empty card and an unrelated element beside
    // it, and cannot show that one is the other's contents.
    const inner = registry
      .describeAll()
      .find((capability) => capability.id === innerId)
    assert.equal(inner?.owner, cardId)

    await tree.unmount()
  })
}

/**
 * A card is named by its title: `content.card` told an agent nothing, so
 * every dashboard row looked identical in discovery and an agent had to
 * read each card to learn which was which. The title a person reads first
 * is now the label the card registers under, and the id derives from it;
 * the title is still state that read() reports, so one read of one card
 * never re-derives it from the label.
 *
 * Reads sit outside `act`, exactly like every read in this file.
 */
for (const base of BASES) {
  test(`[${base}] card: a titled card is listed under its title, not "Card"`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: {} },
        React.createElement(mod.CardTitle, null, "Total Revenue"),
      ),
    )

    const capability = registry
      .describeAll()
      .find((candidate) => candidate.kind === "content")
    assert.ok(capability, "the card must register a capability")
    assert.equal(capability.label, "Total Revenue")

    await tree.unmount()
  })

  test(`[${base}] card: a titled card's id derives from the title, not from a counter`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: {} },
        React.createElement(mod.CardTitle, null, "Total Revenue"),
      ),
    )

    const capability = registry
      .describeAll()
      .find((candidate) => candidate.kind === "content")
    assert.ok(capability, "the card must register a capability")
    assert.match(
      capability.id,
      /total-revenue/,
      "the id must come from the title an agent reads, not from a counter",
    )

    await tree.unmount()
  })

  test(`[${base}] card: a card without a title keeps the generic "Card"`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(React.createElement(mod.Card, { agent: {} }))

    const capability = registry
      .describeAll()
      .find((candidate) => candidate.kind === "content")
    assert.ok(capability, "the card must register a capability")
    assert.equal(capability.label, "Card")

    await tree.unmount()
  })

  test(`[${base}] card: an explicit agent.label beats the title`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: { label: "Explicit" } },
        React.createElement(mod.CardTitle, null, "Total Revenue"),
      ),
    )

    const capability = registry
      .describeAll()
      .find((candidate) => candidate.kind === "content")
    assert.ok(capability, "the card must register a capability")
    assert.equal(capability.label, "Explicit")
    assert.match(capability.id, /explicit/)
    assert.doesNotMatch(capability.id, /total-revenue/)

    await tree.unmount()
  })

  test(`[${base}] card: read() still reports the title as state`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(
      React.createElement(
        mod.Card,
        { agent: {} },
        React.createElement(mod.CardTitle, null, "Total Revenue"),
      ),
    )

    const capability = registry
      .describeAll()
      .find((candidate) => candidate.kind === "content")
    assert.ok(capability, "the card must register a capability")
    const state = registry.read(capability.id) as { title: string | null }
    assert.equal(
      state.title,
      "Total Revenue",
      "the title stays state, so a single read does not re-derive it from the label",
    )

    await tree.unmount()
  })

  test(`[${base}] card: title-derived ids stay distinct, including for repeated titles`, async () => {
    const mod = modules.get(`${base}/card`)
    assert.ok(mod, `the ${base} card module must load`)
    const tree = await mount(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          mod.Card,
          { agent: {} },
          React.createElement(mod.CardTitle, null, "Total Revenue"),
        ),
        React.createElement(
          mod.Card,
          { agent: {} },
          React.createElement(mod.CardTitle, null, "Subscriptions"),
        ),
        React.createElement(
          mod.Card,
          { agent: {} },
          React.createElement(mod.CardTitle, null, "Total Revenue"),
        ),
      ),
    )

    const capabilities = registry
      .describeAll()
      .filter((candidate) => candidate.kind === "content")
    assert.equal(capabilities.length, 3, "each card must register a capability")

    const revenues = capabilities.filter(
      (candidate) => candidate.label === "Total Revenue",
    )
    const subscriptions = capabilities.filter(
      (candidate) => candidate.label === "Subscriptions",
    )
    assert.equal(revenues.length, 2)
    assert.equal(subscriptions.length, 1)

    // Cards titled differently get different ids, each from its own title.
    assert.match(revenues[0].id, /total-revenue/)
    assert.match(subscriptions[0].id, /subscriptions/)
    assert.notEqual(revenues[0].id, subscriptions[0].id)

    // Cards titled the same still get distinct ids, both from the shared title.
    assert.match(revenues[1].id, /total-revenue/)
    assert.notEqual(
      revenues[0].id,
      revenues[1].id,
      "two cards titled the same must not collide on one id",
    )

    await tree.unmount()
  })
}

/**
 * A data table's rows are data, not a view of them: pagination is how the
 * page shows rows to a person, so `read()` reports every row of the filtered
 * and sorted model — not just the ten the paginator renders — in that
 * model's order, and the tools layer, not the component, bounds the output.
 * The reads and tool calls below sit outside `act`, exactly like every tool
 * call in this file.
 */
interface ScoreRow {
  id: string
  name: string
  score: number
  tier: string
  secret: string
}

const SCORE_ROWS: ScoreRow[] = Array.from({ length: 40 }, (_, index) => ({
  id: `p-${String(index + 1).padStart(2, "0")}`,
  name: `Person ${index + 1}`,
  score: 40 - index,
  tier: index % 4 === 0 ? "gold" : "standard",
  secret: `ss-${index}`,
}))

const scoreColumns = [
  { id: "name", header: "Name", accessor: (row: ScoreRow) => row.name },
  { id: "score", header: "Score", accessor: (row: ScoreRow) => row.score },
  { id: "tier", header: "Tier", accessor: (row: ScoreRow) => row.tier },
  // Rendered but not semantic: reading across pages must not reveal it.
  {
    id: "secret",
    header: "Secret",
    accessor: (row: ScoreRow) => row.secret,
    agentHidden: true,
  },
]

function mountScoreTable(base: (typeof BASES)[number], id: string) {
  const mod = modules.get(`${base}/data-table`)
  assert.ok(mod, `the ${base} data-table module must load`)
  return mount(
    React.createElement(mod.DataTable, {
      agent: { id, label: "Scores" },
      data: SCORE_ROWS,
      columns: scoreColumns,
      getRowId: (row: ScoreRow) => row.id,
      pageSize: 10,
    }),
  )
}

for (const base of BASES) {
  test(`[${base}] data-table: a read reports every row of the model, not just the rendered page`, async () => {
    const id = `${base}-data-table-read-all-rows`
    const tree = await mountScoreTable(base, id)

    const state = registry.read(id) as {
      rows: { id: string; cells: Record<string, unknown> }[]
      page: number
      pageSize: number
      pageCount: number
      rowCount: number
      totalRowCount: number
    }

    assert.equal(state.rows.length, 40, "all 40 rows, not the 10 the page renders")
    assert.deepEqual(
      state.rows.map((row) => row.id),
      SCORE_ROWS.map((row) => row.id),
      "the rows come back in the model's order",
    )
    // Paging stays in the state: it is what says what the person is looking at.
    assert.equal(state.page, 1)
    assert.equal(state.pageSize, 10)
    assert.equal(state.pageCount, 4)
    assert.equal(state.rowCount, 40)
    assert.equal(state.totalRowCount, 40)

    await tree.unmount()
  })

  test(`[${base}] data-table: filtering narrows rows and rowCount across pages`, async () => {
    const id = `${base}-data-table-filter-across-pages`
    const tree = await mountScoreTable(base, id)

    const output = JSON.parse(
      await tool("table_filter").execute({ target: id, column: "tier", value: "gold" }),
    )

    assert.equal(output.ok, true)
    const gold = SCORE_ROWS.filter((row) => row.tier === "gold")
    assert.equal(output.state.rowCount, gold.length)
    assert.equal(output.state.page, 1)
    assert.deepEqual(
      output.state.rows.map((row: { id: string }) => row.id),
      gold.map((row) => row.id),
      "every match is reported, including the ones the paginator would have hidden on later pages",
    )

    await tree.unmount()
  })

  test(`[${base}] data-table: rows come back in the sorted model's order`, async () => {
    const id = `${base}-data-table-sorted-order`
    const tree = await mountScoreTable(base, id)

    const output = JSON.parse(
      await tool("table_sort").execute({ target: id, column: "score", direction: "asc" }),
    )

    assert.equal(output.ok, true)
    assert.deepEqual(output.state.sort, [{ column: "score", direction: "asc" }])
    assert.deepEqual(
      output.state.rows.map((row: { cells: { score: number } }) => row.cells.score),
      SCORE_ROWS.map((row) => row.score).sort((a, b) => a - b),
    )

    await tree.unmount()
  })

  test(`[${base}] data-table: an agentHidden column is absent from every row the read reports`, async () => {
    const id = `${base}-data-table-agent-hidden`
    const tree = await mountScoreTable(base, id)

    const state = registry.read(id) as {
      rows: { cells: Record<string, unknown> }[]
    }
    assert.equal(state.rows.length, 40)
    for (const row of state.rows) {
      assert.equal(
        "secret" in row.cells,
        false,
        "reading across pages is not a licence to cross the agentHidden boundary",
      )
    }

    await tree.unmount()
  })
}

/**
 * Selecting every row must be one gesture, not one id per row: the agent
 * would otherwise have to read all of them first and send an input that grows
 * with the table. The gesture is only legitimate if it leaves the page in the
 * state a person's own gesture leaves it in, so that is what is asserted —
 * the tool's result against a real press of the header checkbox.
 */
for (const base of BASES) {
  test(`[${base}] data-table: select-all through the tool leaves the same state as pressing the header checkbox`, async () => {
    const { pressElement } = (await import("../src/lib/agent-ui/press")) as {
      pressElement: (element: HTMLElement) => void
    }

    const humanId = `${base}-data-table-select-all-by-hand`
    const byHand = await mountScoreTable(base, humanId)
    const header = byHand.container.querySelector('[aria-label="Select all rows"]')
    assert.ok(header, "the table must render a select-all checkbox")
    await withAct(async () => {
      pressElement(header as HTMLElement)
    })
    const { selectedRowIds: byHuman } = registry.read(humanId) as {
      selectedRowIds: string[]
    }
    await byHand.unmount()

    assert.equal(
      byHuman.length,
      SCORE_ROWS.length,
      "precondition: the header checkbox selects the whole filtered model, not the rendered page",
    )

    const agentId = `${base}-data-table-select-all-by-tool`
    const byTool = await mountScoreTable(base, agentId)
    const output = JSON.parse(
      await tool("table_select_all_rows").execute({ target: agentId, selected: true }),
    )

    assert.equal(output.ok, true)
    assert.deepEqual(
      output.state.selectedRowIds,
      byHuman,
      "the agent's gesture and the person's gesture are the same gesture",
    )

    const cleared = JSON.parse(
      await tool("table_select_all_rows").execute({ target: agentId, selected: false }),
    )
    assert.deepEqual(cleared.state.selectedRowIds, [])

    await byTool.unmount()
  })
}
