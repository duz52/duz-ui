"use client"

/**
 * Agent UI — Command.
 *
 * A command palette is a text box and a list of things you press, and both
 * already exist in the protocol:
 *
 *  - CommandInput carries the same `input` capability as Input — same state,
 *    same actions, same refusals. cmdk owns the search string: Command's
 *    value/onValueChange is the highlighted item, while the Input's pair is
 *    the search text. Holding it through useControllableState lets the
 *    application own it too, and gives the agent's set_value the channel
 *    typing uses, so a set filters the list exactly like a keystroke.
 *  - CommandItem is a thing you press: `kind: "button"`, whose `button_press`
 *    tool already exists — a dedicated item kind would multiply the protocol
 *    for no gain. The press goes through pressElement(), like Button's.
 *  - Command is `kind: "content"` and owns the rest: the search string, how
 *    many items the current filter left mounted, and the empty text — enough
 *    to see at a glance whether a filter matched anything. It contributes its
 *    capability id as the container owner, so the input and the items nest
 *    under the palette instead of the page, and sets no itemLabel: an item's
 *    own name is already specific.
 *
 * An item cmdk has filtered out is unmounted and registers nothing — after
 * `input_set_value`, listing the palette shows exactly the matches.
 * CommandDialog adds nothing of its own: the dialog and the palette already
 * provide everything.
 */

import * as React from "react"
import { Command as CommandPrimitive, useCommandState } from "cmdk"

import { cn } from "@/lib/utils"
import { AgentContainerProvider } from "@/lib/agent-ui/agent-container"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { pressElement } from "@/lib/agent-ui/press"
import { useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { readText } from "@/lib/agent-ui/agent-content"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/base/ui/input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

function assertMutable(node: HTMLInputElement | null): HTMLInputElement {
  if (!node) {
    rejectState("Input is not mounted.")
  }
  if (node.disabled) {
    rejectState("Input is disabled and cannot be changed.")
  }
  if (node.readOnly) {
    rejectState("Input is read-only and cannot be changed.")
  }
  return node
}

type InputState = {
  value: string
  type: string
  disabled: boolean
  readOnly: boolean
  placeholder: string | null
}

type InputActions = {
  set_value: { value: string }
  clear: Record<string, never>
}

/** Cap for the empty-state text a palette read reports. */
const EMPTY_MAX_LENGTH = 200

/** Cap for a command item's resolved name, matching the shared resolver. */
const ITEM_NAME_MAX_LENGTH = 100

/**
 * Resolves a command item's accessible name. The item's element is
 * `role="option"`, which the accessible-name specification takes its name
 * from content — but the shared resolver's content-named list stops at the
 * menu-item roles, so the item walks the same precedence here: an explicit
 * `aria-label` or `aria-labelledby` wins, otherwise the item's own text is
 * its name.
 */
function useCommandItemName(
  ref: React.RefObject<HTMLElement | null>,
  fallback: string,
): string {
  const [name, setName] = React.useState(fallback)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const labelledBy = element.getAttribute("aria-labelledby")
    const resolved =
      element.getAttribute("aria-label")?.trim() ||
      (labelledBy
        ? labelledBy
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .trim()
        : "") ||
      readText(element, ITEM_NAME_MAX_LENGTH) ||
      fallback
    if (resolved !== name) {
      setName(resolved)
    }
  })

  return name
}

type CommandContentState = {
  search: string
  itemCount: number
  emptyText: string | null
}

type CommandItemState = {
  label: string
  disabled: boolean
}

type CommandItemActions = {
  press: Record<string, never>
}

function Command({
  className,
  ref,
  agent,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & {
  agent?: AgentProp
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(ref, rootRef)

  // Reads are pull-based: they run only when an agent calls ui_list or
  // ui_read, never on render and never in an effect. The committed DOM is
  // the truth: the input's value is the search string, and the items cmdk
  // left mounted are exactly the ones its filter matched.
  const { id } = useCapability<CommandContentState, Record<string, never>>({
    agent,
    kind: "content",
    defaultLabel: "Command palette",
    read: () => {
      const root = rootRef.current
      if (!root) return { search: "", itemCount: 0, emptyText: null }
      const input = root.querySelector<HTMLInputElement>("[cmdk-input]")
      const empty = root.querySelector("[cmdk-empty]")
      return {
        search: input?.value ?? "",
        itemCount: root.querySelectorAll("[cmdk-item]").length,
        emptyText: empty ? readText(empty, EMPTY_MAX_LENGTH) : null,
      }
    },
    actions: {},
  })
  // Every capability rendered inside the palette — the search input, the
  // items — belongs to it. When the palette opted out, `id` is undefined
  // and the provider passes `ownerId: undefined`, so descendants stay roots.
  return (
    <AgentContainerProvider ownerId={id}>
      <CommandPrimitive
        ref={mergedRef}
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
          className
        )}
        {...props}
      />
    </AgentContainerProvider>
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ref,
  value,
  onValueChange,
  agent,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  agent?: AgentProp
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const label = useAccessibleName(inputRef, "Command input")
  const mergedRef = useMergedRef(ref, inputRef)

  // cmdk owns the search string, and the application may own it back through
  // `value`/`onValueChange`. useControllableState is the channel both sides
  // share: typing and the agent's set_value travel the same path, so a set
  // filters the list exactly like a keystroke.
  const [search, setSearch] = useControllableState({
    prop: value,
    defaultProp: "",
    onChange: onValueChange,
  })

  useCapability<InputState, InputActions>({
    agent,
    kind: "input",
    defaultLabel: label,
    read: () => {
      const node = inputRef.current
      if (!node) {
        return {
          value: "",
          type: "text",
          disabled: false,
          readOnly: false,
          placeholder: null,
        }
      }
      return {
        value: node.value,
        type: node.type,
        disabled: node.disabled,
        readOnly: node.readOnly,
        placeholder: node.placeholder || null,
      }
    },
    actions: {
      set_value(input) {
        const next = expectString(input, "value")
        assertMutable(inputRef.current)
        setSearch(next)
      },
      clear() {
        assertMutable(inputRef.current)
        setSearch("")
      },
    },
  })

  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={mergedRef}
          {...props}
          value={search}
          onValueChange={setSearch}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ref,
  disabled = false,
  agent,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
  agent?: AgentProp
}) {
  const itemRef = React.useRef<HTMLDivElement>(null)
  const label = useCommandItemName(itemRef, "Command item")
  const mergedRef = useMergedRef(ref, itemRef)

  // cmdk filters by unmounting the item's element, and this wrapper stays
  // mounted around a primitive that renders null — so the capability follows
  // the element instead of the component: the store's filtered count pings
  // the wrapper whenever filtering happens, and registration is gated on the
  // element actually being there. A filtered-out item registers nothing,
  // which is what makes `input_set_value` narrow the palette to its matches.
  useCommandState((state) => state.filtered.count)
  const [rendered, setRendered] = React.useState(false)
  React.useLayoutEffect(() => {
    const present = itemRef.current !== null
    if (present !== rendered) {
      setRendered(present)
    }
  })

  // An item is a thing you press. `kind: "button"` already exists and
  // already carries a `button_press` tool, so modelling the item as a new
  // kind would multiply the protocol for no gain.
  useCapability<CommandItemState, CommandItemActions>({
    agent: rendered ? agent : false,
    kind: "button",
    defaultLabel: label,
    read: () => ({ label, disabled }),
    actions: {
      press() {
        if (disabled) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        // A press, not a bare click: the full sequence a person makes.
        pressElement(itemRef.current!)
      },
    },
  })

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      disabled={disabled}
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className
      )}
      ref={mergedRef}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
