import { ApiError } from "@medbrains/api";

/**
 * What a picker says when its lookup failed. A refusal and an outage are
 * both faults, never "no results" — an empty list reads as a fact about the
 * hospital (no such patient, no such test) and gets someone registered twice.
 */
export function searchErrorText(error: unknown, what: string): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.status === 403) {
    return `You don't have access to search ${what}. Ask an administrator for it.`;
  }
  return `Could not search ${what} — ${error instanceof Error ? error.message : "try again"}.`;
}
