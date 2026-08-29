/**
 * card example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx agent-ui add`.
 */

import type * as React from "react"

import { Badge } from "@/components/radix/ui/badge"
import { Button } from "@/components/radix/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/radix/ui/card"

export function Preview(): React.JSX.Element {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Team plan</CardTitle>
        <CardDescription>For teams of up to 20 people.</CardDescription>
        <CardAction>
          <Badge variant="secondary">Current</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          $20 per member per month, billed yearly.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Manage seats
        </Button>
      </CardFooter>
    </Card>
  )
}

export const usage = `<Card>
  <CardHeader>
    <CardTitle>Team plan</CardTitle>
    <CardDescription>For teams of up to 20 people.</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>…</CardFooter>
</Card>`
