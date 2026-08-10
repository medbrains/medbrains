/**
 * Presenting clinical values to the patient they belong to.
 *
 * The judgement here is about tone, not formatting. A lab flag shown to a
 * clinician is a triage signal; the same flag shown to the person whose blood
 * it is, alone, on a phone, is frightening. These decide how loud to be.
 */

import type { BadgeTone } from "@/components/ui";

/**
 * How prominently to mark a flagged result.
 *
 * Nothing renders as danger. The server already withholds results carrying an
 * unacknowledged critical alert, so a patient never sees one here before a
 * clinician has spoken to them — and shouting at them about a mildly high
 * value they are about to discuss anyway is alarm without information.
 */
export function flagTone(flag: string | null | undefined): BadgeTone {
  if (!flag) {
    return "neutral";
  }
  return isOutsideRange(flag) ? "warning" : "neutral";
}

/**
 * Whether a flag means "outside the usual range".
 *
 * Matched loosely on purpose. Labs write `H`, `high`, `L`, `low`, `abnormal`
 * and worse, and an unrecognised flag is treated as *not* outside range —
 * adding a caution to a normal result is its own harm, and the value and range
 * are on screen either way.
 */
export function isOutsideRange(flag: string | null | undefined): boolean {
  if (!flag) {
    return false;
  }
  const normalised = flag.trim().toLowerCase();
  return (
    normalised === "h" ||
    normalised === "l" ||
    normalised.includes("high") ||
    normalised.includes("low") ||
    normalised.includes("abnormal") ||
    normalised.includes("critical")
  );
}

/**
 * A timestamp as a patient reads it.
 *
 * Date only. A time-of-day on a lab result invites somebody to reason about
 * how long it took, which is not information the portal is offering.
 */
export function portalDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
