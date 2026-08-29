import { index, layout, route, type RouteConfig } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  layout("routes/gallery-layout.tsx", [
    route("components", "routes/components.tsx"),
    route("components/:base/:name", "routes/component.tsx"),
  ]),
  route("docs", "routes/docs.tsx"),
  route("docs/:slug", "routes/doc.tsx"),
  route("playground", "routes/playground.tsx"),
  route("demo", "routes/demo.tsx"),
] satisfies RouteConfig
