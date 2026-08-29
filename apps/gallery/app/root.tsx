import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router"

import type { Route } from "./+types/root"
import "./app.css"

import { SiteHeader } from "@/components/site/site-header"

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
]

const THEME_BOOTSTRAP = `(() => {
  const root = document.documentElement
  const media = matchMedia("(prefers-color-scheme: dark)")
  // Reading storage throws outright when a browser is set to block site data.
  // This runs before first paint, so an uncaught throw here is a blank page.
  const read = () => { try { return localStorage.getItem("agent-ui-theme") } catch { return null } }
  const stored = read()
  root.classList.toggle("dark", stored ? stored === "dark" : media.matches)
  // With no stored choice the page keeps following the system while open.
  // The storage re-check keeps a choice made after load winning.
  if (!stored) {
    media.addEventListener("change", (e) => {
      if (!read()) {
        root.classList.toggle("dark", e.matches)
      }
    })
  }
})()`

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below may put "dark" on
    // <html> before hydration, so server and client legitimately differ on
    // this one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Inline, not a module: the theme class must be on <html> before
            the first paint, and a bundled module always executes after it.
            Keep the resolution identical to theme-toggle.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <>
      <SiteHeader />
      {/* No width here: the gallery is full bleed and every other route gets
          its column from `site-layout`. */}
      <Outlet />
    </>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? "This page does not exist."
      : error.statusText
    : "Something went wrong."

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-3 px-6">
      <p className="font-mono text-sm text-muted-foreground">{status}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{message}</h1>
      <a className="text-sm underline underline-offset-4" href="/">
        Back to Agent UI
      </a>
    </main>
  )
}
