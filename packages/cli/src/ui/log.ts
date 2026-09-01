/**
 * Duz UI — CLI logger.
 *
 * Thin wrapper over picocolors. Every user-facing string is in English.
 * `error` prints only the neutral `message`; the full `cause` goes to
 * `console.error` exclusively when `DUZ_UI_DEBUG` is set, so a stack trace
 * never leaks to the user otherwise.
 */

import pc from "picocolors"

export function title(message: string): void {
  console.log(pc.bold(message))
}

export function info(message: string): void {
  console.log(message)
}

export function step(message: string): void {
  console.log(`- ${message}`)
}

export function success(message: string): void {
  console.log(pc.green(message))
}

export function warn(message: string): void {
  console.log(pc.yellow(message))
}

export function error(message: string, cause?: unknown): void {
  console.error(pc.red(message))
  if (cause !== undefined && process.env.DUZ_UI_DEBUG) {
    console.error(cause)
  }
}

export function blank(): void {
  console.log()
}
