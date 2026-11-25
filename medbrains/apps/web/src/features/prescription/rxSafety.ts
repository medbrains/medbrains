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
