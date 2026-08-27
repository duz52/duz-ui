import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
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
