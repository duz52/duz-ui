/**
 * Persistent navigation for the component gallery.
 *
 * Scoped to the base in the URL (`/components/:base/:name`) and derived from
 * the registry at render time — never hardcode component names here; the
 * list grows constantly.
 */

import { Link, useLocation, useParams } from "react-router"

import { BASES, listItems, type GalleryItem } from "@/registry"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/radix/ui/sidebar"

type GalleryItemStatus = NonNullable<GalleryItem["agentUi"]>["status"]

const GROUPS: { status: GalleryItemStatus; label: string }[] = [
  { status: "agent-native", label: "Agent-native" },
  { status: "presentation", label: "Presentation" },
  { status: "explicit-semantics", label: "Explicit semantics" },
]

export function GallerySidebar(): React.JSX.Element {
  const { base } = useParams()
  const { pathname } = useLocation()
  // Pages outside `/components/:base/:name` (the `/components` index) have no
  // base in the URL. Both trees are installed, so any base keeps the links
  // addressable; the first registry-derived one is the deterministic choice.
  const activeBase = base ?? BASES[0] ?? ""
  const items = listItems(activeBase)

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
          const groupItems = items.filter(
            (item) => item.agentUi?.status === group.status,
          )
          if (groupItems.length === 0) {
            return null
          }
          return (
            <SidebarGroup key={group.status}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupItems.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          pathname ===
                          `/components/${activeBase}/${item.name}`
                        }
                      >
                        <Link to={`/components/${activeBase}/${item.name}`}>
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
