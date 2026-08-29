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
  defaultProp: string
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
   * Extra props a base needs when the two primitives name the same concept
   * differently. Binding only — the capability contract stays identical.
   */
  baseProps?: (base: (typeof BASES)[number]) => AnyProps
  mount: (mod: ComponentModule, props: AnyProps) => React.ReactElement
}

function changePropName(def: CaseDef, base: (typeof BASES)[number]): string {
  return typeof def.changeProp === "function" ? def.changeProp(base) : def.changeProp
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
    for (const def of CASES) {
      modules.set(
        `${base}/${def.component}`,
        (await import(`../src/bases/${base}/ui/${def.component}`)) as ComponentModule,
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
    [def.controlledProp]: value,
    [changePropName(def, base)]: (...args: unknown[]) => {
      seen.push(def.extractChange(args))
      setValue(seen[seen.length - 1])
    },
  })
}

for (const base of BASES) {
  test(`[${base}] capability descriptors match the frozen contract`, async () => {
    for (const def of CASES) {
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

  for (const def of CASES) {
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
      // deepEqual, not equal: the accordion and slider contracts report an
      // array value, which strict identity can never hold across JSON.parse.
      // For every primitive-valued case it asserts exactly what equal did.
      assert.deepEqual(
        output.state[def.stateKey],
        def.newValue,
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
          [def.defaultProp]: def.initialValue,
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
}
