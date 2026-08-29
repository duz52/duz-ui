/**
 * Sticky top bar: the `agent-ui` wordmark in mono plus primary navigation.
 *
 * A thin bottom border separates it from the page body. No gradient, no
 * glassmorphism — solid `bg-background`.
 */

import { Link, NavLink } from "react-router"

const NAV = [
  { to: "/components", label: "Components" },
  { to: "/docs", label: "Docs" },
  { to: "/playground", label: "Playground" },
  { to: "/demo", label: "Demo" },
] as const

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-6">
        <Link
          to="/"
          className="font-mono text-sm font-medium tracking-tight"
        >
          agent-ui
        </Link>
        <nav className="flex items-center gap-6">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "text-sm text-foreground"
                  : "text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
