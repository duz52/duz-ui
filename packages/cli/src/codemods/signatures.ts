/**
 * Agent UI — codemod component signatures.
 *
 * Each signature describes a stock shadcn/ui implementation that
 * `agent-ui migrate` can safely replace with the Agent UI version from the
 * registry. Lists are derived from the vendored stock sources in
 * `docs/internal/reference/shadcn/*.tsx`. Do not edit them by hand unless the
 * stock source changes.
 */

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
   * Module specifiers the stock implementation may import its primitive from.
   * Current shadcn uses the unified "radix-ui" package; older generations used
   * the scoped per-primitive packages.
   */
  primitiveModules: string[]
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
    primitiveModules: ["radix-ui", "@radix-ui/react-tabs"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-select"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-checkbox"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-dialog"],
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
    primitiveModules: [],
    internalDeclarations: [],
  },
  {
    name: "textarea",
    requiredExports: ["Textarea"],
    primitiveModules: [],
    internalDeclarations: [],
  },
  {
    name: "switch",
    requiredExports: ["Switch"],
    primitiveModules: ["radix-ui", "@radix-ui/react-switch"],
    internalDeclarations: [],
  },
  {
    name: "radio-group",
    requiredExports: ["RadioGroup", "RadioGroupItem"],
    primitiveModules: ["radix-ui", "@radix-ui/react-radio-group"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-dialog"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-alert-dialog"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-toggle"],
    internalDeclarations: ["toggleVariants"],
  },
  {
    name: "collapsible",
    requiredExports: ["Collapsible", "CollapsibleTrigger", "CollapsibleContent"],
    primitiveModules: ["radix-ui", "@radix-ui/react-collapsible"],
    internalDeclarations: [],
  },
  {
    name: "popover",
    requiredExports: [
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
    ],
    primitiveModules: ["radix-ui", "@radix-ui/react-popover"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-slot"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-accordion"],
    internalDeclarations: [],
  },
  {
    name: "slider",
    requiredExports: ["Slider"],
    primitiveModules: ["radix-ui", "@radix-ui/react-slider"],
    internalDeclarations: [],
  },
  {
    name: "input-otp",
    requiredExports: ["InputOTP"],
    primitiveModules: ["input-otp"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-dropdown-menu"],
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
    primitiveModules: ["radix-ui", "@radix-ui/react-hover-card"],
    internalDeclarations: [],
  },
]
