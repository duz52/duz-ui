/**
 * Persistent navigation for the component gallery.
 *
 * Scoped to the base in the URL (`/components/:base/:name`) and derived from
 * the registry at render time — never hardcode component names here; the
 * list grows constantly.
 */

import { Link, useLocation, useParams, useRouteLoaderData } from "react-router"

import { basesOf, listItems, type GalleryIndexItem } from "@/registry"
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

type GalleryItemStatus = NonNullable<GalleryIndexItem["agentUi"]>["status"]

const GROUPS: { status: GalleryItemStatus; label: string }[] = [
  { status: "agent-native", label: "Agent-native" },
  { status: "presentation", label: "Presentation" },
]

export function GallerySidebar(): React.JSX.Element {
  const { base } = useParams()
  const { pathname } = useLocation()
  // Pages outside `/components/:base/:name` (the `/components` index) have no
  // base in the URL. Both trees are installed, so any base keeps the links
  // addressable; the first registry-derived one is the deterministic choice.
  const index =
    useRouteLoaderData<{ items: GalleryIndexItem[] }>("root")
      ?.items ?? []
  const activeBase = base ?? basesOf(index)[0] ?? ""
  const items = listItems(index, activeBase)

  return (
    // The container positions itself: `fixed inset-y-0 left-0 h-svh`.
    // Overriding that with `sticky` is what previously dropped the sidebar
    // into the page flow, and overriding `inset-y-0` with `top-14` leaves two
    // rules fighting over `top`. So the frame is left alone and the list is
    // padded clear of the sticky header instead, which the header covers
    // anyway (header z-50, sidebar z-10).
    <Sidebar
      collapsible="none"
      // Positioning follows the variant: the `none` branch renders a plain
      // in-flow div (only the offcanvas branch positions itself `fixed`), so
      // the sticky column is ours to declare. `overflow-hidden` keeps the
      // frame still and `overscroll-none` stops the list handing its scroll
      // to the page when it reaches the end — both taken from shadcn's own
      // docs sidebar, where they are what make it feel anchored.
      // Hidden below `lg`, where 16rem of it would leave the reading column
      // 134px wide. Mobile reaches the same list through the `/components`
      // index and the ⌘K palette, which searches it — the same split shadcn's
      // own docs sidebar makes.
      className="sticky top-14 z-30 hidden h-[calc(100svh-3.5rem)] overflow-hidden overscroll-none bg-transparent lg:block"
    >
      {/* A hairline that fades out at both ends, rather than a hard border
          running the full height. */}
      <div
        aria-hidden
        className="absolute inset-y-4 right-0 w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_12%,var(--border)_88%,transparent_100%)]"
      />
      <SidebarContent className="gap-6 overflow-x-hidden py-6 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
