/**
 * Agent UI — codemod component signatures.
 *
 * Each signature describes a stock shadcn/ui implementation that
 * `agent-ui migrate` can safely replace with the Agent UI version from the
 * registry. Lists are derived from the vendored stock sources in
 * `docs/internal/reference/shadcn/<base>/*.tsx`. Do not edit them by hand
 * unless the stock source changes.
 */

import type { RegistryBase } from "../registry/client.js"

export interface ComponentSignature {
  /** Registry item name, and the expected file base name. */
  name: string
  /**
   * Minimum public API that identifies the component. Every name here must be
   * exported by the stock file; a stock file from any generation that omits one
   * of these is not the component we recognise. An export that only the newest
   * generation has makes every older stock file unsupported, and `unsupported`
   * cannot be overridden by `--overwrite`.
   */
  requiredExports: string[]
  /**
   * Module specifiers the stock implementation may import its primitive from,
   * per primitive base. Radix's unified `radix-ui` package and the older
   * scoped packages; Base UI's per-component subpath. Some Base UI stock files
   * import more than one subpath (radio-group needs `radio-group` and `radio`;
   * menubar needs `menubar` and `menu`), and a component may have no primitive
   * on a base at all (radix `input` is a plain element; Base UI's is a
   * primitive) — that base lists an empty array.
   */
  primitiveModules: Record<RegistryBase, string[]>
  /**
   * Every other top-level name a stock generation may define (variants objects,
   * internal helpers). A stock file may define any subset of these; the
   * local-modification check allows exactly the names listed here.
   */
  internalDeclarations: string[]
}

export const SIGNATURES: ComponentSignature[] = [
  {
    name: "tabs",
    requiredExports: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-tabs"],
      base: ["@base-ui/react/tabs"],
    },
    internalDeclarations: ["tabsListVariants"],
  },
  {
    name: "select",
    requiredExports: [
      "Select",
      "SelectContent",
      "SelectItem",
      "SelectTrigger",
      "SelectValue",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-select"],
      base: ["@base-ui/react/select"],
    },
    internalDeclarations: [
      "SelectGroup",
      "SelectLabel",
      "SelectScrollDownButton",
      "SelectScrollUpButton",
      "SelectSeparator",
    ],
  },
  {
    name: "checkbox",
    requiredExports: ["Checkbox"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-checkbox"],
      base: ["@base-ui/react/checkbox"],
    },
    internalDeclarations: [],
  },
  {
    // A plain button is pressable: its accessible name — "Send Invitation",
    // "Save changes" — is the semantics, and it is right there in the DOM.
    // This is not the same as an AgentAction, which is a described,
    // confirmable business action ("Delete account") the developer chooses
    // to expose; a pressable button does not replace it.
    name: "button",
    requiredExports: ["Button", "buttonVariants"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-slot"],
      base: ["@base-ui/react/button"],
    },
    internalDeclarations: [],
  },
  {
    name: "dialog",
    requiredExports: [
      "Dialog",
      "DialogContent",
      "DialogTitle",
      "DialogTrigger",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-dialog"],
      base: ["@base-ui/react/dialog"],
    },
    internalDeclarations: [
      "DialogClose",
      "DialogDescription",
      "DialogFooter",
      "DialogHeader",
      "DialogOverlay",
      "DialogPortal",
    ],
  },
  {
    name: "input",
    requiredExports: ["Input"],
    primitiveModules: {
      radix: [],
      base: ["@base-ui/react/input"],
    },
    internalDeclarations: [],
  },
  {
    name: "textarea",
    requiredExports: ["Textarea"],
    primitiveModules: {
      radix: [],
      base: [],
    },
    internalDeclarations: [],
  },
  {
    name: "switch",
    requiredExports: ["Switch"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-switch"],
      base: ["@base-ui/react/switch"],
    },
    internalDeclarations: [],
  },
  {
    name: "radio-group",
    requiredExports: ["RadioGroup", "RadioGroupItem"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-radio-group"],
      base: ["@base-ui/react/radio-group", "@base-ui/react/radio"],
    },
    internalDeclarations: [],
  },
  {
    name: "sheet",
    requiredExports: [
      "Sheet",
      "SheetContent",
      "SheetTitle",
      "SheetTrigger",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-dialog"],
      base: ["@base-ui/react/dialog"],
    },
    internalDeclarations: [
      "SheetPortal",
      "SheetOverlay",
      "SheetClose",
      "SheetDescription",
      "SheetFooter",
      "SheetHeader",
    ],
  },
  {
    name: "alert-dialog",
    requiredExports: [
      "AlertDialog",
      "AlertDialogAction",
      "AlertDialogCancel",
      "AlertDialogContent",
      "AlertDialogTitle",
      "AlertDialogTrigger",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-alert-dialog"],
      base: ["@base-ui/react/alert-dialog"],
    },
    internalDeclarations: [
      "AlertDialogMedia",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogOverlay",
      "AlertDialogPortal",
    ],
  },
  {
    name: "toggle",
    requiredExports: ["Toggle"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-toggle"],
      base: ["@base-ui/react/toggle"],
    },
    internalDeclarations: ["toggleVariants"],
  },
  {
    name: "collapsible",
    requiredExports: ["Collapsible", "CollapsibleTrigger", "CollapsibleContent"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-collapsible"],
      base: ["@base-ui/react/collapsible"],
    },
    internalDeclarations: [],
  },
  {
    name: "popover",
    requiredExports: [
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-popover"],
      base: ["@base-ui/react/popover"],
    },
    internalDeclarations: [
      "PopoverHeader",
      "PopoverAnchor",
      "PopoverTitle",
      "PopoverDescription",
    ],
  },
  {
    name: "sidebar",
    requiredExports: [
      "Sidebar",
      "SidebarContent",
      "SidebarFooter",
      "SidebarGroup",
      "SidebarGroupContent",
      "SidebarGroupLabel",
      "SidebarHeader",
      "SidebarMenu",
      "SidebarMenuButton",
      "SidebarMenuItem",
      "SidebarProvider",
      "SidebarTrigger",
      "useSidebar",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-slot"],
      base: ["@base-ui/react/use-render", "@base-ui/react/merge-props"],
    },
    internalDeclarations: [
      "SIDEBAR_COOKIE_NAME",
      "SIDEBAR_COOKIE_MAX_AGE",
      "SIDEBAR_WIDTH",
      "SIDEBAR_WIDTH_MOBILE",
      "SIDEBAR_WIDTH_ICON",
      "SIDEBAR_KEYBOARD_SHORTCUT",
      "SidebarContextProps",
      "SidebarContext",
      "sidebarMenuButtonVariants",
      "SidebarGroupAction",
      "SidebarInset",
      "SidebarInput",
      "SidebarRail",
      "SidebarSeparator",
      "SidebarMenuAction",
      "SidebarMenuBadge",
      "SidebarMenuSkeleton",
      "SidebarMenuSub",
      "SidebarMenuSubButton",
      "SidebarMenuSubItem",
    ],
  },
  {
    name: "accordion",
    requiredExports: [
      "Accordion",
      "AccordionItem",
      "AccordionTrigger",
      "AccordionContent",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-accordion"],
      base: ["@base-ui/react/accordion"],
    },
    internalDeclarations: [],
  },
  {
    name: "slider",
    requiredExports: ["Slider"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-slider"],
      base: ["@base-ui/react/slider"],
    },
    internalDeclarations: [],
  },
  {
    name: "input-otp",
    requiredExports: ["InputOTP"],
    primitiveModules: {
      radix: ["input-otp"],
      base: ["input-otp"],
    },
    internalDeclarations: [
      "InputOTPGroup",
      "InputOTPSlot",
      "InputOTPSeparator",
    ],
  },
  {
    name: "dropdown-menu",
    requiredExports: [
      "DropdownMenu",
      "DropdownMenuTrigger",
      "DropdownMenuContent",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-dropdown-menu"],
      base: ["@base-ui/react/menu"],
    },
    internalDeclarations: [
      "DropdownMenuPortal",
      "DropdownMenuGroup",
      "DropdownMenuItem",
      "DropdownMenuCheckboxItem",
      "DropdownMenuRadioGroup",
      "DropdownMenuRadioItem",
      "DropdownMenuLabel",
      "DropdownMenuSeparator",
      "DropdownMenuShortcut",
      "DropdownMenuSub",
      "DropdownMenuSubTrigger",
      "DropdownMenuSubContent",
    ],
  },
  {
    name: "hover-card",
    requiredExports: [
      "HoverCard",
      "HoverCardTrigger",
      "HoverCardContent",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-hover-card"],
      base: ["@base-ui/react/preview-card"],
    },
    internalDeclarations: [],
  },
  {
    name: "context-menu",
    requiredExports: [
      "ContextMenu",
      "ContextMenuTrigger",
      "ContextMenuContent",
    ],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-context-menu"],
      base: ["@base-ui/react/context-menu"],
    },
    internalDeclarations: [
      "ContextMenuPortal",
      "ContextMenuGroup",
      "ContextMenuSub",
      "ContextMenuSubTrigger",
      "ContextMenuSubContent",
      "ContextMenuItem",
      "ContextMenuCheckboxItem",
      "ContextMenuRadioGroup",
      "ContextMenuRadioItem",
      "ContextMenuLabel",
      "ContextMenuSeparator",
      "ContextMenuShortcut",
    ],
  },
  {
    name: "menubar",
    requiredExports: ["Menubar", "MenubarTrigger", "MenubarContent"],
    primitiveModules: {
      radix: ["radix-ui", "@radix-ui/react-menubar"],
      base: ["@base-ui/react/menubar", "@base-ui/react/menu"],
    },
    internalDeclarations: [
      "MenubarPortal",
      "MenubarMenu",
      "MenubarGroup",
      "MenubarRadioGroup",
      "MenubarRadioItem",
      "MenubarItem",
      "MenubarCheckboxItem",
      "MenubarLabel",
      "MenubarSeparator",
      "MenubarShortcut",
      "MenubarSub",
      "MenubarSubTrigger",
      "MenubarSubContent",
    ],
  },
  {
    name: "drawer",
    requiredExports: ["Drawer", "DrawerTrigger", "DrawerContent"],
    primitiveModules: {
      radix: ["vaul"],
      base: ["@base-ui/react/drawer"],
    },
    internalDeclarations: [
      "DrawerPortal",
      "DrawerOverlay",
      "DrawerClose",
      "DrawerHeader",
      "DrawerFooter",
      "DrawerTitle",
      "DrawerDescription",
      // The current Base UI generation implements Drawer on a React context
      // and exports a swipe handle; the Radix (vaul) generation has none of
      // these. A stock file may define any subset.
      "DrawerContextProps",
      "DrawerContext",
      "useDrawer",
      "DrawerSwipeHandle",
    ],
  },
  {
    name: "card",
    requiredExports: [
      "Card",
      "CardHeader",
      "CardFooter",
      "CardTitle",
      "CardAction",
      "CardDescription",
      "CardContent",
    ],
    // Card is plain elements on both bases; there is no primitive to import.
    primitiveModules: {
      radix: [],
      base: [],
    },
    internalDeclarations: [],
  },
  {
    name: "chart",
    requiredExports: [
      "ChartContainer",
      "ChartTooltip",
      "ChartTooltipContent",
      "ChartLegend",
      "ChartLegendContent",
      "ChartStyle",
      "ChartConfig",
    ],
    // Recharts is the charting library on both bases.
    primitiveModules: {
      radix: ["recharts"],
      base: ["recharts"],
    },
    internalDeclarations: [
      "THEMES",
      "INITIAL_DIMENSION",
      "TooltipNameType",
      "ChartContextProps",
      "ChartContext",
      "useChart",
      "getPayloadConfigFromPayload",
    ],
  },
  {
    name: "table",
    requiredExports: [
      "Table",
      "TableHeader",
      "TableBody",
      "TableFooter",
      "TableHead",
      "TableRow",
      "TableCell",
      "TableCaption",
    ],
    // Table is plain elements on both bases; there is no primitive to import.
    primitiveModules: {
      radix: [],
      base: [],
    },
    internalDeclarations: [],
  },
]
