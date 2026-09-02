# Duz UI

An agent-native component library. shadcn-compatible React components that
expose their own capabilities to WebMCP agents, with no agent code in the
application.

> One interface. Two users: humans and agents.

**[ui.duz52.com](https://ui.duz52.com)** — components, documentation and a live
WebMCP playground. The package is [`duz-ui`](https://www.npmjs.com/package/duz-ui);
its README is the place to start if you want to *use* this rather than work on
it.

```bash
npx duz-ui migrate     # upgrade the shadcn components a project already has
npx duz-ui add data-table
npx duz-ui doctor      # report integration status; repairs nothing
```

## Architecture

Five layers, one responsibility each. A mounted component becomes a tool going
down; a tool call reaches the component coming back up.

```text
React Component        components/ui/*.tsx       component state
      ↓
Capability             lib/duz-ui/capability.ts  semantic interaction
      ↓
Capability Registry    lib/duz-ui/registry.ts    live identity and dispatch
      ↓
Protocol Adapter       lib/duz-ui/webmcp.ts      protocol exposure
      ↓
WebMCP                 document.modelContext     the browser's tool surface
```

The CLI owns installation, the codemods own migration, and the gallery owns
presentation and documentation. **No layer may independently reconstruct
another layer's truth**: the registry is canonical for which capabilities are
live, React is canonical for component state, and the adapter is the only thing
that touches `document.modelContext`.

The reasoning behind each layer is on the site:
[capability kernel](https://ui.duz52.com/docs/capability-kernel),
[React binding](https://ui.duz52.com/docs/react-binding),
[WebMCP adapter](https://ui.duz52.com/docs/webmcp-adapter).

## Repository layout

```text
packages/registry     source of truth for everything the CLI distributes
  src/lib/duz-ui      capability kernel, React binding, WebMCP adapter
  src/bases/radix/ui  agent-native components on Radix UI
  src/bases/base/ui   the same components on Base UI
  registry.json       the shadcn-compatible manifest, and each item's sources
  build.ts            inlines those sources into apps/gallery/public/r/*.json

packages/cli          the `duz-ui` CLI: init, add, migrate, doctor
  src/codemods        ts-morph migration of stock shadcn implementations

apps/gallery          docs, component browser, WebMCP playground, admin demo
                      React Router v8 on a Cloudflare Worker, served from
                      ui.duz52.com — and the registry the CLI reads from
```

Two rules hold this together, and both are enforced rather than remembered:

- **The gallery has no demo-only implementation path.** Its
  `app/components/{base,radix}/ui/` and `app/lib/duz-ui/` are produced by
  running the real CLI against the real registry (`pnpm sync:gallery`), so the
  site renders exactly what a user receives.
- **Every kernel source must be shipped by some registry item.** `build.ts`
  refuses to build a registry that would leave a runtime file unreachable.

## Development

```bash
pnpm install
pnpm dev                # gallery, at the URL Vite prints
```

`pnpm dev` serves the gallery from the registry output already committed under
`apps/gallery/public/r/`. After changing anything in `packages/`, re-run the
pipeline that puts it there:

```bash
pnpm sync:gallery       # build the registry, build the CLI, install with it
```

Note that `sync:gallery` rewrites files underneath a running dev server; restart
it afterwards rather than trusting what it serves.

## Verifying

```bash
pnpm verify             # sync, typecheck, test, and build the gallery
```

That is the gate. It runs the registry suite — components mounted in jsdom and
driven through the real registry, the WebMCP wire format, and identity — and the
CLI suite, which materialises temporary projects and runs the built binary
against them.

Behaviour that only a browser can settle is not settled by these. WebMCP
registration, whether a migrated app renders at all, and anything about how an
agent actually experiences a page need real Chrome.

## Deploying

```bash
pnpm --filter gallery deploy
```

The gallery is both the documentation site and the registry `duz-ui` installs
from, so deploying it publishes the components.

## Trying the agent surface

WebMCP is a proposal. Chrome exposes it behind
`chrome://flags/#enable-webmcp-testing`, or through the origin trial from
Chrome 149.

Without WebMCP the gallery is an ordinary React site, and the
[playground](https://ui.duz52.com/playground) executes the same tool
definitions in-page — so the semantics are inspectable either way.

## License

MIT. See [LICENSE](LICENSE).
