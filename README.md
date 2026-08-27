# Agent UI

React components that ship with native agent semantics.

Agent UI is a shadcn-compatible component system where supported interactive
components expose their semantic capabilities to WebMCP-capable agents
automatically.

```bash
npx agent-ui migrate
```

Run this on an existing shadcn-based React site and supported components become
agent-operable without application-level WebMCP integration code.

```bash
npx agent-ui add data-table
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

The full specification is `docs/specs/mvp.spec`.

## Repository layout

```text
packages/registry   source of truth for everything the CLI distributes
  src/lib/agent-ui  capability kernel, React binding, WebMCP adapter
  src/ui            agent-native components
  registry.json     the shadcn-compatible registry manifest
  build.ts          inlines sources into apps/gallery/public/r/*.json

packages/cli        the `agent-ui` CLI: init, add, migrate, doctor
  src/codemods      ts-morph migration of stock shadcn implementations

apps/gallery        docs, registry browser, WebMCP playground, challenge demo
                    React Router v8 on a Cloudflare Worker
```

The gallery contains **no demo-only implementation path**. Its
`app/components/ui/` and `app/lib/agent-ui/` directories are produced by running
the real CLI against the real registry (`pnpm sync:gallery`).

## Development

```bash
pnpm install
pnpm build:registry     # emit apps/gallery/public/r/*.json
pnpm build:cli          # build the agent-ui binary
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
