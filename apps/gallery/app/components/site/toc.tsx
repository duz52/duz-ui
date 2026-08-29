/**
 * "On This Page" table of contents for component pages, following shadcn's
 * docs-toc: a static anchor list whose active item is tracked by an
 * IntersectionObserver that fires once a heading crosses into the top 20% of
 * the viewport.
 *
 * The list is fully static — every section always renders — so it is correct
 * on the server too. The observer only runs in an effect on the client.
 */

import * as React from "react"

export interface TocSection {
  id: string
  title: string
}

function useActiveId(ids: string[]): string | null {
  const [activeId, setActiveId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "0% 0% -80% 0%" },
    )

    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    }

    return () => {
      observer.disconnect()
    }
  }, [ids])

  return activeId
}

export function Toc({
  sections,
}: {
  sections: readonly TocSection[]
}): React.JSX.Element | null {
  const ids = React.useMemo(() => sections.map((s) => s.id), [sections])
  const activeId = useActiveId(ids)

  if (sections.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs font-medium text-muted-foreground">On This Page</p>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:font-medium data-[active=true]:text-foreground"
          data-active={section.id === activeId}
        >
          {section.title}
        </a>
      ))}
    </div>
  )
}
