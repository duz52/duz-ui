/**
 * alert example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/radix/ui/alert"

export function Preview(): React.JSX.Element {
  return (
    <Alert variant="destructive" className="max-w-sm">
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>
        Your card was declined. Try another payment method.
      </AlertDescription>
    </Alert>
  )
}

export const usage = `<Alert variant="destructive">
  <AlertTitle>Payment failed</AlertTitle>
  <AlertDescription>Your card was declined.</AlertDescription>
</Alert>`
