"use client"

import * as React from "react"

export function useControllableState<T>(options: {
  prop: T | undefined
  defaultProp: T
  onChange?: (value: T) => void
}): [T, (next: T) => void] {
  const { prop, defaultProp, onChange } = options

  const [internal, setInternal] = React.useState<T>(defaultProp)
  const value = prop !== undefined ? (prop as T) : internal

  const latest = React.useRef({ isControlled: prop !== undefined, onChange })
  React.useLayoutEffect(() => {
    latest.current = { isControlled: prop !== undefined, onChange }
  })

  const setValue = React.useCallback(
    (next: T) => {
      if (!latest.current.isControlled) {
        setInternal(next)
      }
      latest.current.onChange?.(next)
    },
    [],
  )

  return [value, setValue]
}
