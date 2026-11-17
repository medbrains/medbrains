import type { OpdReportDay } from "@medbrains/types";

export type ReportPreset = "today" | "week" | "month" | "custom";

/** An inclusive range of hospital-local days, as YYYY-MM-DD. */
export interface DayRange {
  from: string;
  to: string;
}

/** `d` as YYYY-MM-DD in the browser's own day, which is the desk's day. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The range a preset means on `today`: the week starts on Monday; month and week end today. */
export function presetRange(preset: Exclude<ReportPreset, "custom">, today: Date): DayRange {
  const start = new Date(today);
  if (preset === "week") start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (preset === "month") start.setDate(1);
  return { from: isoDay(start), to: isoDay(today) };
}

/** The by-day table as CSV rows, headed the way the screen heads its columns. */
export function byDayCsvRows(days: OpdReportDay[]): {
  headers: string[];
  rows: Array<Array<string | number>>;
} {
  return {
    headers: ["Date", "OPD visits", "Registrations", "New patients", "Repeat patients"],
    rows: days.map((d) => [d.date, d.visits, d.registrations, d.new, d.repeat]),
  };
}
