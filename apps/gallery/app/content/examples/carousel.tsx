/**
 * carousel example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/radix/ui/carousel"

export function Preview(): React.JSX.Element {
  return (
    // The arrows hang outside the viewport, so the carousel needs the
    // horizontal padding around it.
    <div className="px-12">
      <Carousel>
        <CarouselContent>
          {["One", "Two", "Three", "Four"].map((slide) => (
            <CarouselItem key={slide}>
              <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                Slide {slide}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

export const usage = `// Moving someone through slides is not a task anyone asks an agent
// to do, so the component exposes nothing to an agent.
<Carousel>
  <CarouselContent>
    <CarouselItem>…</CarouselItem>
    <CarouselItem>…</CarouselItem>
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`
