import type { Config } from "@react-router/dev/config"

export default {
  // The Cloudflare Vite plugin does not support SPA mode or pre-rendering, so
  // the gallery is server-rendered on the Worker.
  ssr: true,
} satisfies Config
