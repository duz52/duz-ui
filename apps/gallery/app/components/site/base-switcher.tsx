/**
 * Base switcher on the component page: a row of plain links, one per base
 * that actually carries this component, the way shadcn does it. A component
 * missing from a base simply has no tab here — it is never greyed out.
 */

import { Link } from "react-router"

import { BASE_TITLES, basesFor } from "@/registry"

export function BaseSwitcher({
  name,
  base,
}: {
  name: string
  base: string
}): React.JSX.Element | null {
  const bases = basesFor(name)
  // A switcher with one option is noise.
  if (bases.length < 2) {
    return null
  }
  return (
    <div className="flex items-center gap-1">
      {bases.map((b) => (
        <Link
          key={b}
          to={`/components/${b}/${name}`}
          data-active={base === b}
          className="rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-muted data-[active=true]:font-medium data-[active=true]:text-foreground"
        >
          {BASE_TITLES[b] ?? b}
        </Link>
      ))}
    </div>
  )
}
