/**
 * Words for the form friction report: a readable name for a route template,
 * and the change against the period before.
 */
import type { BadgeTone } from "@/components/ui";

/** The periods a reader may pick, in days. */
export const PERIOD_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/**
 * "Specialty › Ophthalmology › Exams" from `/api/specialty/ophthalmology/exams`.
 * Ids (`{id}`) are dropped and words are split on `-` and `_`; a route with
 * nothing left keeps its template.
 */
export function screenName(route: string): string {
  const words = route
    .replace(/^\/api\//, "")
    .split("/")
    .filter((part) => part !== "" && !part.startsWith("{"))
    .map((part) => part.replace(/[-_]+/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return words.length > 0 ? words.join(" › ") : route;
}

/** A change against the previous period: fewer refusals is good news. */
export interface Trend {
  label: string;
  tone: BadgeTone;
}

/** "New", "Same", "+50%" or "−25%" for `count` against `previous`. */
export function trendOf(count: number, previous: number): Trend {
  if (previous === 0) {
    return count > 0 ? { label: "New", tone: "warning" } : { label: "Same", tone: "neutral" };
  }
  const pct = Math.round(((count - previous) / previous) * 100);
  if (pct === 0) return { label: "Same", tone: "neutral" };
  return pct > 0
    ? { label: `+${pct}%`, tone: "warning" }
    : { label: `−${Math.abs(pct)}%`, tone: "success" };
}
