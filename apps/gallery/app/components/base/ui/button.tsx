import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { useMergedRef } from "@/lib/agent-ui/use-merged-ref"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { rejectState } from "@/lib/agent-ui/validate"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonState = {
  label: string
  disabled: boolean
  type: string
}

type ButtonActions = {
  press: Record<string, never>
}

function Button({
  className,
  variant = "default",
  size = "default",
  ref,
  agent,
  ...props
}: Omit<ButtonPrimitive.Props, "ref" | "className"> &
  VariantProps<typeof buttonVariants> & {
    /** Matches the ref type the library publishes on the component itself. */
    ref?: React.Ref<HTMLElement>
    className?: string
    agent?: AgentProp
  }) {
  const elementRef = React.useRef<HTMLElement>(null)
  const label = useAccessibleName(elementRef, "Button")
  const mergedRef = useMergedRef(ref, elementRef)

  useCapability<ButtonState, ButtonActions>({
    agent: agentWithElementId(agent, props.id),
    kind: "button",
    defaultLabel: label,
    read: () => {
      const element = elementRef.current
      return {
        label,
        disabled: element?.hasAttribute("disabled") ?? false,
        // The element's own type attribute; an untyped <button> defaults to
        // "submit" inside a form and "button" outside one.
        type:
          element?.getAttribute("type") ??
          (element?.closest("form") ? "submit" : "button"),
      }
    },
    actions: {
      press() {
        if (elementRef.current?.hasAttribute("disabled")) {
          rejectState(`"${label}" is disabled and cannot be pressed right now.`)
        }
        // A click is what a person does: it is the only activation that also
        // submits the surrounding form, fires label behaviour, and runs
        // whatever handlers other libraries attached to the element. Calling
        // onClick directly would skip all of that.
        elementRef.current?.click()
      },
    },
  })

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      ref={mergedRef}
      {...props}
    />
  )
}

export { Button, buttonVariants }
