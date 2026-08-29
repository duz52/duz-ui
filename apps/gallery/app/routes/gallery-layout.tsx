import { Outlet } from "react-router"

import { GallerySidebar } from "@/components/site/gallery-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/radix/ui/sidebar"

// Unlike shadcn's docs sidebar, this sidebar is deliberately collapsible —
// do NOT pass `collapsible="none"`. SidebarProvider registers a `disclosure`
// capability (open/close/toggle) with the agent runtime; a non-collapsing
// sidebar would still advertise that capability while ignoring it, so an
// agent calling disclosure_toggle would get a success result and nothing
// would move. The SidebarTrigger below stays visible when the sidebar is
// collapsed, so the advertised capability is one a person can drive too.
export default function GalleryLayout(): React.JSX.Element {
  return (
    <SidebarProvider
      agent={{ id: "gallery-nav", label: "Gallery navigation" }}
      className="min-h-min items-start md:grid md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] md:has-data-[collapsible=offcanvas]:grid-cols-[minmax(0,1fr)]"
      style={
        { "--sidebar-width": "calc(var(--spacing) * 64)" } as React.CSSProperties
      }
    >
      <GallerySidebar />
      <div className="w-full">
        <SidebarTrigger className="mb-4" />
        <Outlet />
      </div>
    </SidebarProvider>
  )
}
