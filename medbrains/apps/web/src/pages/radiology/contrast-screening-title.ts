import type { ContrastScreeningResult } from "@medbrains/types";
import type { AlertTone } from "@/components/ui";

/**
 * The heading of the pre-contrast screening alert: the clearance in words,
 * and the eGFR it was judged on with the day that sample was taken, so a
 * stale value is visible. No qualifying eGFR, no number: the screen asks for
 * a creatinine/eGFR before contrast instead.
 */
export function contrastScreeningTitle(screen: ContrastScreeningResult): string {
  if (screen.clearance === "egfr_required") {
    return "Pre-contrast screening — creatinine/eGFR needed before contrast";
  }
  const clearance = screen.clearance.replace(/_/g, " ");
  if (screen.egfr == null) return `Pre-contrast screening — ${clearance}`;
  const taken = screen.egfr_measured_on ? ` on ${screen.egfr_measured_on}` : "";
  return `Pre-contrast screening — ${clearance} · eGFR ${Math.round(screen.egfr)}${taken}`;
}

/**
 * The alert's tone. Only "proceed" is success: an unknown clearance, or one
 * waiting on an eGFR, is never shown as safe.
 */
export function contrastScreeningTone(screen: ContrastScreeningResult): AlertTone {
  if (screen.clearance === "proceed") return "success";
  if (screen.clearance === "proceed_with_caution") return "warning";
  return "danger";
}
