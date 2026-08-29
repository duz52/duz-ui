"use client"

import * as React from "react"

export function useControllableState<T>(options: {
  prop: T | undefined
  defaultProp: T
  onChange?: (value: T) => void
  /**
   * Whether the application owns the value. Defaults to `prop !== undefined`,
   * which is how every primitive with a distinct empty value spells it. A
   * primitive whose empty value *is* `undefined` cannot say it that way and
   * passes the switch explicitly.
   */
  controlled?: boolean
}): [T, (next: T) => void] {
  const { prop, defaultProp, onChange, controlled } = options

  const isControlled = controlled ?? prop !== undefined

  const [internal, setInternal] = React.useState<T>(defaultProp)
  const value = isControlled ? (prop as T) : internal

  const latest = React.useRef({ isControlled, onChange })
  React.useLayoutEffect(() => {
    latest.current = { isControlled, onChange }
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
