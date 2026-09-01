import { Outlet } from "react-router"

import type { Route } from "./+types/gallery-layout"
import { fetchIndex, type GalleryIndexItem } from "@/registry"
import { GallerySidebar } from "@/components/site/gallery-sidebar"
import { SidebarProvider } from "@/components/radix/ui/sidebar"

// The docs sidebar does not collapse, exactly as shadcn's does not: its rows
// are words, and every collapsed variant of this component either hides the
// list entirely (offcanvas, leaving nowhere for a trigger but the reading
// column) or clips the words to a rail (icon).
//
// It therefore registers no capability. `agent={false}` is the honest
// spelling: SidebarProvider would otherwise advertise a disclosure an agent
// could call and nothing would move. The sidebar's real capability is
// demonstrated on the Sidebar component's own page, with an example built
// for it.
export async function loader({
  context,
  request,
}: Route.LoaderArgs): Promise<{ items: GalleryIndexItem[] }> {
  return { items: await fetchIndex(context, request) }
}

export default function GalleryLayout(): React.JSX.Element {
  return (
    <SidebarProvider
      agent={false}
      className="min-h-min items-start"
      style={
        {
          "--sidebar-width": "16rem",
          // The panel reads as page furniture rather than a floating card.
          "--sidebar": "var(--background)",
        } as React.CSSProperties
      }
    >
      <GallerySidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </SidebarProvider>
  )
}
