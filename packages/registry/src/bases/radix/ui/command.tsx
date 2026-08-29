"use client"

/**
 * Agent UI — Command.
 *
 * Wraps `cmdk` and binds exactly one part of it: the search input. Typing
 * into a command palette is setting a search string and nothing else, so
 * CommandInput carries the same `input` capability as Input — same state,
 * same actions, same refusals — driven through the native value channel of
 * the <input> element cmdk renders.
 *
 * The items are deliberately not bound. CommandItem's meaning is the
 * application's onSelect handler, not the component's own state — a
 * component cannot know what that handler means, and exposing it would let
 * an agent invoke arbitrary application logic the application never
 * declared. The root's value/onValueChange is the highlighted item, not a
 * chosen one; exposing it would advertise a choice that does nothing. Use
 * AgentAction to declare an explicit agent action when needed.
 */

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectString, rejectState } from "@/lib/agent-ui/validate"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

// A native <input> has exactly one semantic channel for changing its value:
// setting the .value property and letting the input event propagate. cmdk's
// Input renders a native <input> and listens to React's onChange — a
// delegated listener for that native event — so the channel works whether
// the search string is controlled or owned by cmdk's store.
function setNativeValue(node: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )
  descriptor?.set?.call(node, value)
  node.dispatchEvent(new Event("input", { bubbles: true }))
}

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

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
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
  agent,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  agent?: AgentProp
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const label = useAccessibleName(inputRef, "Command input")
  const mergedRef = useMergedRef(ref, inputRef)

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
        const node = assertMutable(inputRef.current)
        setNativeValue(node, next)
      },
      clear() {
        const node = assertMutable(inputRef.current)
        setNativeValue(node, "")
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

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className
      )}
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
