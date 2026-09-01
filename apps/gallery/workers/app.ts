import { RouterContextProvider, createRequestHandler } from "react-router"

import { cloudflare } from "../app/cloudflare"

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
)

export default {
  fetch(request, env, ctx) {
    const context = new RouterContextProvider()
    context.set(cloudflare, { env, ctx })
    return requestHandler(request, context)
  },
} satisfies ExportedHandler<Env>
