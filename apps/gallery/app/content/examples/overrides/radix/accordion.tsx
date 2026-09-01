/**
 * Accordion example for the radix tree — hand-written because the bases' usage
 * differs here: Radix discriminates single and multiple with `type`, Base UI
 * has only multiple.
 *
 * Both examples open independently, because a component page that behaves one
 * way under one base and another way under the other is documenting the
 * example rather than the component. Multiple is the mode both primitives
 * express identically, which is why the parity tests bind it too.
 */

import type * as React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/radix/ui/accordion"

export function Preview(): React.JSX.Element {
  return (
    <Accordion
      type="multiple"
      defaultValue={["item-1"]}
      agent={{ id: "preview-accordion", label: "Preview accordion" }}
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>What is Agent UI?</AccordionTrigger>
        <AccordionContent>
          A registry of agent-native React components for real applications.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How do I add a component?</AccordionTrigger>
        <AccordionContent>
          Run <code>npx agent-ui add</code> and pick the component.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export const usage = `<Accordion
  type="multiple"
  defaultValue={["item-1"]}
  agent={{ id: "faq", label: "FAQ" }}
>
  <AccordionItem value="item-1">
    <AccordionTrigger>What is Agent UI?</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>`
