import { Outlet } from "react-router"

/**
 * The reading column for every route except the gallery.
 *
 * The width used to live in `root.tsx`, but the gallery's sidebar is
 * `position: fixed` against the viewport edge, and a fixed element cannot
 * sit inside a centred column: the in-flow gap that reserves its width would
 * be in the column while the sidebar itself is at the screen edge. So the
 * shell imposes no width and the routes that want one say so here.
 */
export default function SiteLayout(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Outlet />
    </main>
  )
}
