import { index, layout, route, type RouteConfig } from "@react-router/dev/routes"

export default [
  // The gallery is full bleed: its sidebar is fixed to the viewport edge, so
  // it cannot live inside a centred column. Every other route reads better
  // in one, which `site-layout` provides.
  layout("routes/gallery-layout.tsx", [
    route("components", "routes/components.tsx"),
    route("components/:base/:name", "routes/component.tsx"),
  ]),
  layout("routes/site-layout.tsx", [
    index("routes/home.tsx"),
    route("docs", "routes/docs.tsx"),
    route("docs/:slug", "routes/doc.tsx"),
    route("playground", "routes/playground.tsx"),
    route("demo", "routes/demo.tsx"),
  ]),
] satisfies RouteConfig
