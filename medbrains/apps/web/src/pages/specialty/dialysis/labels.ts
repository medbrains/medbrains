import type { DialysisSerology, DialysisShift } from "@medbrains/types";

export const SEROLOGY_OPTIONS: { value: DialysisSerology; label: string }[] = [
  { value: "none", label: "Seronegative" },
  { value: "hbsag", label: "HBsAg positive" },
  { value: "hcv", label: "HCV positive" },
  { value: "hiv", label: "HIV positive" },
];

export const SHIFT_OPTIONS: { value: DialysisShift; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

export const serologyLabel = (s: DialysisSerology) =>
  SEROLOGY_OPTIONS.find((o) => o.value === s)?.label ?? s;

/** The local calendar date, as the server writes slot dates. */
export function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
