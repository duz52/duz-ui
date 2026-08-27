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
   * of these is not the component we recognise.
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
      "SelectGroup",
      "SelectItem",
      "SelectLabel",
      "SelectScrollDownButton",
      "SelectScrollUpButton",
      "SelectSeparator",
      "SelectTrigger",
      "SelectValue",
    ],
    primitiveModules: ["radix-ui", "@radix-ui/react-select"],
    internalDeclarations: [],
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
      "DialogClose",
      "DialogContent",
      "DialogDescription",
      "DialogFooter",
      "DialogHeader",
      "DialogOverlay",
      "DialogPortal",
      "DialogTitle",
      "DialogTrigger",
    ],
    primitiveModules: ["radix-ui", "@radix-ui/react-dialog"],
    internalDeclarations: [],
  },
  {
    name: "input",
    requiredExports: ["Input"],
    primitiveModules: [],
    internalDeclarations: [],
  },
]
