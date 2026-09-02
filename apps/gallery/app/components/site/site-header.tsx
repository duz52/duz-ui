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

import type { GalleryIndexItem } from "@/registry"
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

/**
 * The same links, in a sheet, for viewports the row does not fit on.
 *
 * `agent={false}`: an agent navigates this site through the search palette,
 * which is on every viewport and searches components and docs together. A
 * second navigation surface registering its own dialog would be one more thing
 * in `ui_list` that leads nowhere the palette does not already reach.
 */
function MobileNav(): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const { pathname } = useLocation()

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
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">duz-ui</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "rounded-md bg-muted px-2 py-1.5 text-sm text-foreground"
                  : "rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
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
          <MobileNav />
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
