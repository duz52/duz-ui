/**
 * Agent UI — codemod component signatures.
 *
 * Each signature is the fingerprint of a stock shadcn/ui implementation that
 * `agent-ui migrate` can safely replace with the Agent UI version from the
 * registry. The lists are derived verbatim from the vendored stock sources in
 * `docs/internal/reference/shadcn/*.tsx`. Do not edit them by hand unless the
 * stock source changes.
 */

export interface ComponentSignature {
  /** Registry item name, and the expected file base name. */
  name: string
  /** Named exports the stock implementation must provide. */
  requiredExports: string[]
  /**
   * Module specifiers the stock implementation may import its primitive from.
   * Current shadcn uses the unified "radix-ui" package; older generations used
   * the scoped per-primitive packages.
   */
  primitiveModules: string[]
  /**
   * Top-level declaration names the stock implementation is allowed to define
   * beyond `requiredExports` (variants objects and internal helpers).
   */
  internalDeclarations: string[]
}

export const SIGNATURES: ComponentSignature[] = [
  {
    name: "tabs",
    requiredExports: [
      "Tabs",
      "TabsList",
      "TabsTrigger",
      "TabsContent",
      "tabsListVariants",
    ],
    primitiveModules: ["radix-ui"],
    internalDeclarations: [],
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
    primitiveModules: ["radix-ui"],
    internalDeclarations: [],
  },
  {
    name: "checkbox",
    requiredExports: ["Checkbox"],
    primitiveModules: ["radix-ui"],
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
    primitiveModules: ["radix-ui"],
    internalDeclarations: [],
  },
  {
    name: "input",
    requiredExports: ["Input"],
    primitiveModules: [],
    internalDeclarations: [],
  },
]
