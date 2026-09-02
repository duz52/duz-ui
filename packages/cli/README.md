# duz-ui

**An agent-native component library.** shadcn-compatible React components that
expose their own capabilities to WebMCP agents — with no agent code in your
application.

> One interface. Two users: humans and agents.

[Documentation](https://ui.duz52.com/docs) ·
[Components](https://ui.duz52.com/components) ·
[Playground](https://ui.duz52.com/playground)

## Start from a shadcn project you already have

```bash
npx duz-ui migrate --overwrite
```

Supported components are upgraded in place. Your imports do not change, your
call sites do not change, and you write no WebMCP code.

The flag is there because a component is replaced only when Duz UI recognises
its source structurally. Anything that has drifted — a tweaked class, an
earlier shadcn generation — is named under `Needs overwrite` and left alone
without it, because replacing it would change how your application looks. On
`satnaing/shadcn-admin`, an ordinary dashboard nobody wrote for this project,
that is every supported component it has: the run without the flag upgrades
none of them and touches no tracked file.

`--overwrite` buys permission to replace an implementation and nothing else —
a component whose exports the replacement would not preserve is refused with
the flag exactly as it is without it. `--dry-run` prints the plan before
anything is written.

Or install a component directly:

```bash
npx duz-ui add data-table
```

## What an agent gets

A migrated page registers a tool surface with the browser. Two tools discover
it, and one tool per kind of capability acts on it — never one per instance, so
a table of five hundred rows exposes exactly what a table of five does.

```
discovery      ui_list, ui_read, ui_fill

tabs           tabs_select
select         select_choose, select_clear
multi-select   multi_select_set
checkbox       checkbox_set
button         button_press
dialog         dialog_open, dialog_close
disclosure     disclosure_open, disclosure_close, disclosure_toggle
input          input_set_value, input_clear
accordion      accordion_expand, accordion_collapse
slider         slider_set
date           date_set
data-table     table_filter, table_sort, table_select_rows,
               table_select_all_rows, table_set_page,
               table_set_column_visibility

action         action_<id>, one per business action you declared yourself
```

An action returns the state your component committed, read back after React
commits it — not the state that was requested. A controlled component that
rejects a value reports the value it kept.

## What it will not do

- **No DOM automation.** Where a semantic action is missing, the request is
  refused. Nothing clicks, types or scrolls on an agent's behalf.
- **No business meaning guessed from a button.** A generic `onClick` never
  becomes an agent action. Consequential actions exist only where you declared
  them with `AgentAction`, which can also require an explicit confirmation.
- **Nothing hidden becomes readable.** What an agent sees is what the
  component's `read()` returns. A data-table column marked `agentHidden` stays
  out of it even though the data is there.
- **No second copy of your state.** React remains the only source of truth.

## Commands

| | |
|---|---|
| `duz-ui init` | Install the runtime and the WebMCP adapter into your project. |
| `duz-ui add <components…>` | Install agent-native components. |
| `duz-ui migrate [components…]` | Upgrade supported shadcn components in place. |
| `duz-ui doctor` | Report integration status. Repairs nothing. |

`--dry-run` prints the plan without writing anything, and every command reads
its paths from your existing `components.json`.

`doctor` is worth running after any of the others. Besides what is installed,
it names a charting or table library you draw with directly while the component
that would make it readable is missing, elements whose id is derived from text
that changes, and a stylesheet missing the state variants the components are
written against.

## Writing your own

Everything the built-in components use is installed into your repo under
`lib/duz-ui/` — there is no package to import from and no plugin to register.
A component you write reaches the same kernel by importing the same files:

```tsx
import { useCapability } from "@/lib/duz-ui/use-capability"
import { expectString, rejectState } from "@/lib/duz-ui/validate"

useCapability({
  agent,
  kind: "select",
  read: () => ({ value, options }),
  actions: {
    choose(input) {
      const next = expectString(input, "value")
      if (!options.some((o) => o.value === next)) {
        rejectState(`"${next}" is not one of the options.`)
      }
      onValueChange(next)
    },
  },
})
```

Declaring an existing `kind` is the whole of the wiring — that component now
answers `select_choose`. An interaction that is yours alone goes through
`AgentAction` instead. See
[Your Own Component](https://ui.duz52.com/docs/custom-components) for the full
surface, including the one trap: the adapter builds tools from a fixed table of
kinds, so a kind you invent is listed and readable while nothing can call it.

## Requirements

React 19 and a shadcn project with a `components.json`. Two primitive bases are
supported, Radix UI and Base UI, and the CLI takes yours from that file's
`style` using shadcn's own encoding — `"<base>-<style>"`, so `radix-new-york`
is Radix and `base-new-york` is Base UI. A legacy style that names no base
(`new-york`, `default`) is read as Radix, and no style at all as Base UI. A
style asking for a base Duz UI does not ship is refused by name rather than
quietly given another one.

WebMCP is a proposal. Chrome exposes it behind
`chrome://flags/#enable-webmcp-testing`, or through the origin trial from
Chrome 149. Without it your application is an ordinary React site, and the
same capabilities are still inspectable — the
[playground](https://ui.duz52.com/playground) runs the identical tool
definitions in-page.

## License

MIT
