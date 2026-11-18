/**
 * Client-safe handle rules. Keep in sync with the `profiles_handle_format_check`
 * constraint in `lib/db/schema.ts`.
 */
export const HANDLE_MAX_LENGTH = 32

export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/

/** Lowercases and strips everything a handle cannot contain, for live typing and pasting. */
export function sanitizeHandleInput(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, HANDLE_MAX_LENGTH)
}

/** Returns a human-readable reason a (sanitized, non-empty) handle is invalid, or null if it is valid. */
export function describeHandleProblem(handle: string) {
  if (HANDLE_PATTERN.test(handle)) return null
  if (handle.startsWith("-")) return "A handle must start with a letter or number."
  if (handle.endsWith("-")) return "A handle can't end with a hyphen."
  return "Use lowercase letters, numbers and hyphens only."
}
