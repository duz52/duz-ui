/**
 * Sticky top bar: the `duz-ui` wordmark in mono plus primary navigation.
 *
 * A thin bottom border separates it from the page body. No gradient, no
 * glassmorphism — solid `bg-background`.
 *
 * Below `md` the links do not fit beside the search button and the theme
 * toggle — measured at 405px of content in a 390px viewport, which made every
 * page on the site scroll sideways — so they move into a sheet behind a menu
 * button, the way shadcn's own site does it.
 */

import * as React from "react"
import { Link, NavLink, useLocation } from "react-router"
import { MenuIcon } from "lucide-react"

import { basesOf, listItems, STATUS_GROUPS, type GalleryIndexItem } from "@/registry"
import { DOC_PAGES } from "@/content/docs"
import { Button } from "@/components/radix/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/radix/ui/sheet"
import { SiteSearch } from "./site-search"
import { ThemeToggle } from "./theme-toggle"

const NAV = [
  { to: "/components", label: "Components" },
  { to: "/docs", label: "Docs" },
  { to: "/playground", label: "Playground" },
  { to: "/demo", label: "Demo" },
] as const

const LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-sm text-foreground"
    : "text-sm text-muted-foreground transition-colors hover:text-foreground"

const SHEET_LINK = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "rounded-md bg-muted px-2 py-1.5 text-sm text-foreground"
    : "rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"

/**
 * The whole site map, in a sheet, for viewports the header row does not fit on.
 *
 * It carries the component list as well as the primary links, because the
 * gallery sidebar is hidden below `lg` and without it a reader on a component
 * page has no way to reach another one but going back to the index. shadcn's
 * own docs put the same tree in the same place for the same reason.
 *
 * `agent={false}`: an agent navigates this site through the search palette,
 * which is on every viewport and searches components and docs together. A
 * second navigation surface registering its own dialog would be one more thing
 * in `ui_list` that leads nowhere the palette does not already reach.
 */
function MobileNav({ items }: { items: GalleryIndexItem[] }): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const { pathname } = useLocation()
  // Read from the path, not from `useParams`: this header renders above the
  // route that declares `:base`, and sending a reader browsing the Radix tree
  // to the Base UI one because the menu defaulted is worse than any layout
  // bug. Only a route that names no base falls back, and then the first
  // registry-derived one is the deterministic choice — the same one the
  // sidebar and the index make.
  const routeBase = /^\/components\/([^/]+)\//.exec(pathname)?.[1]
  const bases = basesOf(items)
  const componentBase =
    routeBase !== undefined && bases.includes(routeBase)
      ? routeBase
      : (bases[0] ?? "")
  const componentItems = listItems(items, componentBase)

  // A sheet that stays open over the page it just navigated to reads as a
  // failed tap. Closing on the path changing covers every way a link is
  // followed, including the browser's own back button.
  React.useEffect(() => setOpen(false), [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen} agent={false}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">duz-ui</SheetTitle>
        </SheetHeader>
        {/* The sheet is `flex flex-col h-full`, so the scroll belongs to this
            region rather than to the panel: the title stays put while a list
            of nearly sixty components moves under it. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={SHEET_LINK}>
                {item.label}
              </NavLink>
            ))}
          </div>

          <Section label="Documentation">
            {DOC_PAGES.map((page) => (
              <NavLink
                key={page.slug}
                to={`/docs/${page.slug}`}
                className={SHEET_LINK}
              >
                {page.title}
              </NavLink>
            ))}
          </Section>

          {STATUS_GROUPS.map((group) => {
            const groupItems = componentItems.filter(
              (item) => item.agentUi?.status === group.status,
            )
            if (groupItems.length === 0) return null
            return (
              <Section key={group.status} label={group.label}>
                {groupItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={`/components/${componentBase}/${item.name}`}
                    className={SHEET_LINK}
                  >
                    {item.title}
                  </NavLink>
                ))}
              </Section>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

export function SiteHeader({
  items,
}: {
  items: GalleryIndexItem[]
}): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-1">
          <MobileNav items={items} />
          <Link to="/" className="font-mono text-sm font-medium tracking-tight">
            duz-ui
          </Link>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={LINK_CLASS}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <SiteSearch items={items} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
