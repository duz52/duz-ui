/**
 * navigation-menu example — one shared source for both bases. Its imports point at
 * the radix tree, which scripts/sync-gallery.mjs rewrites per base, so
 * every base renders the same source a user gets after `npx duz-ui add`.
 */

import type * as React from "react"

import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/radix/ui/navigation-menu"

export function Preview(): React.JSX.Element {
  return (
    <NavigationMenu
      agent={{ id: "preview-navigation-menu", label: "Preview navigation menu" }}
    >
      <NavigationMenuList>
        <NavigationMenuItem value="account">
          <NavigationMenuTrigger>Account</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#">Sign out</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem value="shipping">
          <NavigationMenuTrigger>Shipping</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#">Track order</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export const usage = `<NavigationMenu
  agent={{ id: "site-nav", label: "Site navigation" }}
>
  <NavigationMenuList>
    <NavigationMenuItem value="account">
      <NavigationMenuTrigger>Account</NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink href="/sign-out">Sign out</NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem value="shipping">
      <NavigationMenuTrigger>Shipping</NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink href="/track">Track order</NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`
