/**
 * Light/dark toggle at the end of the site header nav row.
 *
 * The theme class on <html> is decided before first paint by the inline
 * bootstrap script in root.tsx; this control only overrides it. Two states:
 * an explicit choice ("light"/"dark" in localStorage) wins, otherwise the
 * system preference is followed live. A third "system" state was considered
 * and dropped: a reader who toggles wants a definite theme, and clearing the
 * storage key restores system-following for the rare case that needs it.
 */

import { useEffect, useState } from "react"

import { Moon, Sun } from "lucide-react"

// Keep in sync with the inline bootstrap script in root.tsx, which cannot
// import this module (it must run before first paint).
const STORAGE_KEY = "agent-ui-theme"

type Theme = "light" | "dark"

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function storedTheme(): Theme | null {
  // Same reason as the bootstrap script: a browser set to block site data
  // throws on access rather than returning null.
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    return null
  }
}

export function ThemeToggle(): React.JSX.Element {
  // Null until mounted: the server cannot know the resolved theme, so the
  // first client render must match it (same pattern as CopyButton).
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(storedTheme() ?? systemTheme())
    // Track system changes only while no explicit choice is stored — the
    // same rule the bootstrap script applies to the <html> class.
    const media = matchMedia("(prefers-color-scheme: dark)")
    const follow = () => {
      if (storedTheme() === null) setTheme(systemTheme())
    }
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [])

  function toggle(): void {
    // The <html> class is the runtime source of truth; read it rather than
    // state so the flip is correct even if something else moved the class.
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark"
    // The theme still applies when storage is unavailable; only the memory of
    // the choice is lost.
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Blocked site data. Nothing to recover: the class below is what shows.
    }
    document.documentElement.classList.toggle("dark", next === "dark")
    setTheme(next)
  }

  if (theme === null) {
    return <span className="inline-block size-8" aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
