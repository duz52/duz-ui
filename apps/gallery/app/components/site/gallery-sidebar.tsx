/**
 * Persistent navigation for the component gallery.
 *
 * Groups mirror the registry's own `agentUi.status` partition and are derived
 * from the registry at render time — never hardcode component names here;
 * the list grows constantly.
 */

import { Link, useLocation } from "react-router"

import { listItems, type GalleryItem } from "@/registry"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type GalleryItemStatus = NonNullable<GalleryItem["agentUi"]>["status"]

// The registry is a static build-time glob, so derive the navigation once at
// module scope instead of on every route transition.
const ITEMS = listItems()

const GROUPS: { status: GalleryItemStatus; label: string }[] = [
  { status: "agent-native", label: "Agent-native" },
  { status: "presentation", label: "Presentation" },
  { status: "explicit-semantics", label: "Explicit semantics" },
]

export function GallerySidebar(): React.JSX.Element {
  const { pathname } = useLocation()

  return (
    // Sticky inside the layout's grid column so the sidebar stays attached
    // to the centered content; `top-14` clears the sticky site header.
    // `group-data-[collapsible=offcanvas]:hidden` removes the sidebar from
    // view when collapsed — with `position: sticky` the component's built-in
    // `left` slide-out has no effect, so hiding is what makes the collapse
    // real; the layout's grid template reclaims the column at the same time.
    <Sidebar className="sticky top-14 hidden h-[calc(100svh-3.5rem)] md:flex group-data-[collapsible=offcanvas]:hidden">
      <SidebarContent>
        {GROUPS.map((group) => {
          const items = ITEMS.filter(
            (item) => item.agentUi?.status === group.status,
          )
          if (items.length === 0) {
            return null
          }
          return (
            <SidebarGroup key={group.status}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === `/components/${item.name}`}
                      >
                        <Link to={`/components/${item.name}`}>
                          {item.title}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
    </Sidebar>
  )
}
