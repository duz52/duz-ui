/**
 * Accordion example for the radix tree — hand-written because the
 * bases' usage differs here: Radix discriminates single and multiple with `type`.
 */

import type * as React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/radix/ui/accordion"

export function Preview(): React.JSX.Element {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="item-1"
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
  type="single"
  collapsible
  defaultValue="item-1"
  agent={{ id: "faq", label: "FAQ" }}
>
  <AccordionItem value="item-1">
    <AccordionTrigger>What is Agent UI?</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>`
