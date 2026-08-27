/**
 * Agent UI — input validation.
 *
 * Agent input is untrusted. These helpers reject invalid requests with
 * messages an agent can self-correct from. They never coerce, never guess and
 * never compensate for a missing semantic.
 */

import { CapabilityError } from "./capability"

function reject(message: string): never {
  throw new CapabilityError("invalid_input", message)
}

export function expectObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    reject("Arguments must be an object.")
  }
  return input as Record<string, unknown>
}

export function expectString(input: unknown, field: string): string {
  const value = expectObject(input)[field]
  if (typeof value !== "string") reject(`"${field}" must be a string.`)
  return value
}

export function expectOptionalString(input: unknown, field: string): string | undefined {
  const value = expectObject(input)[field]
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") reject(`"${field}" must be a string.`)
  return value
}

export function expectBoolean(input: unknown, field: string): boolean {
  const value = expectObject(input)[field]
  if (typeof value !== "boolean") reject(`"${field}" must be true or false.`)
  return value
}

export function expectInteger(input: unknown, field: string, min: number): number {
  const value = expectObject(input)[field]
  if (typeof value !== "number" || !Number.isInteger(value)) {
    reject(`"${field}" must be a whole number.`)
  }
  if (value < min) reject(`"${field}" must be ${min} or greater.`)
  return value
}

export function expectStringArray(input: unknown, field: string): string[] {
  const value = expectObject(input)[field]
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    reject(`"${field}" must be an array of strings.`)
  }
  return value as string[]
}

export function expectOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): T {
  if (!allowed.includes(value as T)) {
    reject(`"${field}" must be one of: ${allowed.join(", ")}. Received "${value}".`)
  }
  return value as T
}

/** Rejects an action the current component state does not permit. */
export function rejectState(message: string): never {
  throw new CapabilityError("rejected", message)
}
