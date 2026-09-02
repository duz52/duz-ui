/**
 * Site-wide search, as a real ⌘K palette.
 *
 * This is the gallery eating its own cooking. Nothing here is written for an
 * agent: it is the search a person opens with ⌘K, built from the same
 * `Command` the registry ships. Because those components are agent-native, the
 * agent-facing search surface falls out of the human one —
 *
 *   Command       -> kind "content"  : the query and how many results matched
 *   CommandInput  -> kind "input"    : `input_set_value` IS the search
 *   CommandItem   -> kind "button"   : `button_press` opens that page
 *
 * — with no parallel agent UI, and no tool written by hand. A capability an
 * agent can call but a person cannot see would be a second interface; this is
 * the same one.
 *
 * cmdk's own filtering is off (`shouldFilter={false}`). The registry carries
 * over a hundred components, and letting every one of them mount as an item
 * would register over a hundred capabilities the moment the palette opened.
 * Matching here instead keeps the result set bounded, so what the palette
 * shows and what `ui_list` reports are the same short list.
 */

import * as React from "react"
import { useNavigate } from "react-router"
import { SearchIcon } from "lucide-react"

import { basesOf, listItems, type GalleryIndexItem } from "@/registry"
import { DOC_PAGES } from "@/content/docs"
import { Button } from "@/components/radix/ui/button"
import { Kbd } from "@/components/radix/ui/kbd"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/radix/ui/command"

interface SearchResult {
  /** Stable agent id. Named by the thing itself, so it survives a remount. */
  id: string
  title: string
  detail: string
  to: string
  /** Everything the query is matched against, as lowercased words. */
  words: string[]
}

/**
 * The distinct lowercased words of every part, for prefix matching.
 *
 * Words rather than one string, because a raw substring search over
 * descriptions is wrong in a way a reader notices immediately: "table" is
 * inside "settable", so searching for it returned the calendar, the checkbox
 * and five other components that have no table in them. Splitting on
 * non-alphanumerics also makes "select" reach "native-select" and "table"
 * reach "data-table", which a prefix search over the whole string would not.
 */
function wordsOf(parts: string[]): string[] {
  return [
    ...new Set(parts.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)),
  ]
}

/** Results shown per group. Enough to choose from, few enough to read. */
const RESULT_LIMIT = 8

/** Components listed before anything is typed. The docs are few enough to list whole. */
const SUGGESTION_LIMIT = 5

function buildComponentResults(items: GalleryIndexItem[]): SearchResult[] {
  // No base in the URL here, and both trees are installed, so any base keeps
  // the links addressable. The first registry-derived one is the
  // deterministic choice — the same one the sidebar and the index make.
  const base = basesOf(items)[0] ?? ""
  return listItems(items, base).map((item) => {
    const kinds =
      item.agentUi?.status === "agent-native"
        ? item.agentUi.capabilities.map((capability) => capability.kind)
        : []
    return {
      id: `component.${item.name}`,
      title: item.title,
      detail: item.description,
      to: `/components/${base}/${item.name}`,
      // Capability kinds are matched on because they are how someone searches
      // for a component by what it does — "table", "select" — when they do
      // not know what it is called.
      words: wordsOf([item.title, item.name, item.description, ...kinds]),
    }
  })
}

const DOC_RESULTS: SearchResult[] = DOC_PAGES.map((page) => ({
  id: `doc.${page.slug}`,
  title: page.title,
  detail: page.summary,
  to: `/docs/${page.slug}`,
  words: wordsOf([page.title, page.slug, page.summary]),
}))

/**
 * Every term must prefix some word of the result, so "agent table" finds the
 * data table and "zzz table" finds nothing.
 */
function match(results: SearchResult[], query: string, limit: number): SearchResult[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (terms.length === 0) return results.slice(0, limit)
  return results
    .filter((result) =>
      terms.every((term) => result.words.some((word) => word.startsWith(term))),
    )
    .slice(0, limit)
}

export function SiteSearch({ items }: { items: GalleryIndexItem[] }): React.JSX.Element {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const components = React.useMemo(() => buildComponentResults(items), [items])

  const limit = query.trim() === "" ? SUGGESTION_LIMIT : RESULT_LIMIT
  const componentMatches = match(components, query, limit)
  // The doc set is small, so it is never truncated below its own length.
  const docMatches = match(DOC_RESULTS, query, DOC_RESULTS.length)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return
      // The browser binds ⌘K itself in some configurations; the palette is
      // what the shortcut means on this page.
      event.preventDefault()
      setOpen((previous) => !previous)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // The next open starts from an empty query rather than resuming the last
  // search, which is also what makes the palette's first `ui_list` the
  // suggestion set every time.
  const change = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  const go = (to: string) => {
    change(false)
    void navigate(to)
  }

  const group = (label: string, results: SearchResult[]) =>
    results.length === 0 ? null : (
      <CommandGroup heading={label}>
        {results.map((result) => (
          <CommandItem
            key={result.id}
            value={result.id}
            onSelect={() => go(result.to)}
            // Named by the application: a palette row's own text is its
            // component's title, which several rows can share across groups,
            // and the row is the one thing on this page an agent addresses by
            // id after searching for it.
            agent={{
              id: result.id,
              label: result.title,
              description: `Open ${result.to}`,
            }}
          >
            <span className="font-medium">{result.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {result.detail}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => change(true)}
        className="gap-2 text-muted-foreground"
        agent={{
          id: "site-search",
          label: "Search",
          description:
            "Opens the site search palette, which searches every component and documentation page.",
        }}
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={change}
        title="Search"
        description="Search components and documentation."
        agent={{ id: "search-dialog", label: "Site search" }}
      >
        <Command
          shouldFilter={false}
          agent={{ id: "site-search-results", label: "Site search results" }}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search components and docs…"
            agent={{
              id: "site-search-query",
              label: "Search query",
              description:
                "The search string. Setting it narrows the results below to what matches every word.",
            }}
          />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            {group("Components", componentMatches)}
            {group("Documentation", docMatches)}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
