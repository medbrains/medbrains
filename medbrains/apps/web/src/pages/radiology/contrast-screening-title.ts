import type { ContrastScreeningResult } from "@medbrains/types";

/**
 * The heading of the pre-contrast screening alert: the clearance in words,
 * and the eGFR it was judged on with the day that sample was taken, so a
 * stale value is visible. No eGFR, no number: the flags then say the kidney
 * risk was not checked.
 */
export function contrastScreeningTitle(screen: ContrastScreeningResult): string {
  const clearance = screen.clearance.replace(/_/g, " ");
  if (screen.egfr == null) return `Pre-contrast screening — ${clearance}`;
  const taken = screen.egfr_measured_on ? ` on ${screen.egfr_measured_on}` : "";
  return `Pre-contrast screening — ${clearance} · eGFR ${Math.round(screen.egfr)}${taken}`;
}
