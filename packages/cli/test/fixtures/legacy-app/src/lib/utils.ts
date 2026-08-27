import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Application-owned helper that proves migration does not delete project code
 * from lib/utils.ts. A previous defect overwrote this file and dropped every
 * function the application had added next to cn.
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
