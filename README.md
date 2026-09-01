# Duz UI

An agent-native component library.

Duz UI is a shadcn-compatible component system where supported interactive
components expose their semantic capabilities to WebMCP-capable agents
automatically.

```bash
npx duz-ui migrate
```

Run this on an existing shadcn-based React site. A component whose source is
stock is upgraded automatically. A component that is recognised but has drifted
from every known stock source is left untouched and named in the report; hand
it over with `--overwrite`:

```bash
npx duz-ui migrate --overwrite
```

A component whose exports the replacement would not preserve is refused, and
`--overwrite` does not override that. Either way the application writes no
agent code and no call site changes. `migrate` accepts component names, so
ownership can be handed over one component at a time:

```bash
npx duz-ui migrate checkbox --overwrite
```

```bash
npx duz-ui add data-table
```

installs an agent-native component directly.

> **One interface. Two users: humans and agents.**

## Architecture

```text
React Component
      ↓
Capability
      ↓
Capability Registry
      ↓
Protocol Adapter
      ↓
WebMCP
```

React owns component state. The capability owns semantic interaction. The
registry owns live capability identity and dispatch. The WebMCP adapter owns
protocol exposure. The CLI owns installation. The codemod owns migration. The
gallery owns presentation and documentation.

No layer may independently reconstruct another layer's truth.

The full specification is `internal/specs/mvp.spec`.

## Repository layout

```text
packages/registry   source of truth for everything the CLI distributes
  src/lib/duz-ui  capability kernel, React binding, WebMCP adapter
  src/ui            agent-native components
  registry.json     the shadcn-compatible registry manifest
  build.ts          inlines sources into apps/gallery/public/r/*.json

packages/cli        the `duz-ui` CLI: init, add, migrate, doctor
  src/codemods      ts-morph migration of stock shadcn implementations

apps/gallery        docs, registry browser, WebMCP playground, challenge demo
                    React Router v8 on a Cloudflare Worker
```

The gallery contains **no demo-only implementation path**. Its
`app/components/ui/` and `app/lib/duz-ui/` directories are produced by running
the real CLI against the real registry (`pnpm sync:gallery`).

## Development

```bash
pnpm install
pnpm build:registry     # emit apps/gallery/public/r/*.json
pnpm build:cli          # build the duz-ui binary
pnpm sync:gallery       # install the registry into the gallery with the CLI
pnpm dev                # gallery at http://localhost:5173
```

Checks:

```bash
pnpm typecheck
pnpm test               # codemod idempotence and recognition tests
```

Deploy the gallery:

```bash
pnpm --filter gallery deploy
```

## Trying the agent surface

WebMCP is a proposal. Chrome exposes it behind
`chrome://flags/#enable-webmcp-testing`, or through the origin trial from
Chrome 149.

Without WebMCP the gallery is a normal React site and the playground executes
the same tool definitions in-page, so the semantics are inspectable either way.
