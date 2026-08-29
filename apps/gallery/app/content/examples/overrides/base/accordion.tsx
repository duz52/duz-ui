/**
 * Accordion example for the base tree — hand-written because the
 * bases' usage differs here: Base UI has no single-value mode: `multiple` and string[].
 */

import type * as React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/base/ui/accordion"

export function Preview(): React.JSX.Element {
  return (
    <Accordion
      multiple
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
  multiple
  defaultValue={["item-1"]}
  agent={{ id: "faq", label: "FAQ" }}
>
  <AccordionItem value="item-1">
    <AccordionTrigger>What is Agent UI?</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>`
