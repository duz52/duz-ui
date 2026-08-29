import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Every bare package specifier the installed components import.
 *
 * Examples are loaded one dynamic import per component, so without this each
 * new component page is the first time Vite sees that component's primitive
 * (`@base-ui/react/alert-dialog`, and so on). Vite re-runs its dependency
 * optimizer, invalidates the bundle the open page is holding, and the page
 * dies with a 504 on the stale `?v=` URL — which is the "something went
 * wrong" flash on every navigation. Pre-bundling them removes the discovery
 * entirely.
 *
 * Derived from the installed sources rather than listed by hand: the
 * component set changes with every `pnpm sync:gallery`.
 */
function installedPackages(): string[] {
  const roots = readdirSync(join(here, "app/components"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "site")
    .map((entry) => join(here, "app/components", entry.name, "ui"))

  const specifiers = new Set<string>()
  for (const root of roots) {
    for (const file of readdirSync(root)) {
      const source = readFileSync(join(root, file), "utf8")
      for (const match of source.matchAll(/from "([^".][^"]*)"/g)) {
        const specifier = match[1]
        if (!specifier || specifier.startsWith("@/") || specifier.startsWith("."))
          continue
        specifiers.add(specifier)
      }
    }
  }
  return [...specifiers].sort()
}

export default defineConfig({
  optimizeDeps: { include: installedPackages() },
  resolve: {
    tsconfigPaths: true,
    // Without this, the dev server resolves the request for the `/components`
    // route to the `components.json` at the project root and serves shadcn's
    // config instead of the page. Every JSON import here is written with its
    // extension, so dropping it from extension resolution costs nothing.
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx"],
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
})
