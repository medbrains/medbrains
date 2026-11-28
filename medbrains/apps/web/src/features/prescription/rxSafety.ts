import type { RenalDoseAlert, RenalNotChecked } from "@medbrains/types";
import type { RxSafety } from "./RxDoctor";

/** No findings yet: before the first check, and after a failed one. */
export const EMPTY_SAFETY: RxSafety = {
  interactions: [],
  allergy_conflicts: [],
  weight_alerts: [],
  renal_alerts: [],
  renal_not_checked: [],
  hepatic_alerts: [],
  ingredient_alerts: [],
  pregnancy_alerts: [],
  conclusion: { severity: "clear", summary: "", recommendation: "", issue_count: 0 },
};

/** "12 Nov" for an ISO date, in the reader's locale. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * The "Renal dose · eGFR" row. An eGFR under a rule's threshold flags, with the
 * eGFR's date; a renal rule with no recent eGFR warns that it was not checked.
 */
export function renalRow(
  alerts: RenalDoseAlert[],
  notChecked: RenalNotChecked[],
): { state: "ok" | "warn" | "flag"; detail: string } {
  if (alerts.length) {
    const detail = alerts
      .map(
        (r) =>
          `${r.drug_name}: ${r.rule} (eGFR ${r.egfr}, ${shortDate(r.egfr_measured_on)} < ${r.threshold})`,
      )
      .join(" · ");
    return { state: "flag", detail };
  }
  if (notChecked.length) {
    const names = notChecked.map((n) => n.drug_name).join(", ");
    return { state: "warn", detail: `Renal dose not checked — ${names}: ${notChecked[0]?.reason}` };
  }
  return { state: "ok", detail: "No renal dose adjustment flagged" };
}
