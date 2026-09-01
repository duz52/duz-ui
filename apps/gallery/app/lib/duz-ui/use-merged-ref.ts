"use client"

import * as React from "react"

/**
 * Assigns a single node to every ref it was given and returns a callback
 * whose identity stays stable while those refs are unchanged.
 *
 * A fresh callback on every render makes React call the previous ref callback
 * with null and the new one with the node, tearing down and re-attaching every
 * ref — including refs the caller passed in — even when nothing moved.
 * useCallback with the refs as dependencies keeps the identity stable until a
 * ref actually changes.
 */
export function useMergedRef<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return React.useCallback(
    (value: T | null) => {
      for (const ref of refs) {
        if (!ref) continue
        if (typeof ref === "function") {
          ref(value)
        } else {
          ref.current = value
        }
      }
    },
    [...refs],
  )
}
