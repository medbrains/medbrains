// The readiness meters, read at build time from the one checklist in the repo.
// Same arithmetic as scripts/readiness.py, which CI checks: done counts in full,
// partial half, not-started nothing, by each item's weight. Never type a percentage here.
import source from "../../../medbrains/docs/readiness.json";

export type Status = "done" | "partial" | "not-started";
export interface Item { id: string; title: string; weight: number; status: Status }
export interface Meter { id: string; title: string; summary: string; items: Item[]; percent: number }

const CREDIT: Record<Status, number> = { done: 1, partial: 0.5, "not-started": 0 };
export const STATUS_LABEL: Record<Status, string> = { done: "Done", partial: "Partial", "not-started": "Not started" };
export const CHECKLIST_URL = "https://github.com/medbrains/medbrains/blob/main/medbrains/docs/readiness.json";

/** Weighted share of a meter's items that are done, 0-100, rounded like the Python script. */
function percentOf(items: Item[]): number {
  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.reduce((s, i) => s + i.weight * CREDIT[i.status], 0);
  return total ? Math.round((100 * got) / total) : 0;
}

export const METERS: Meter[] = (source.meters as Omit<Meter, "percent">[]).map((m) => ({ ...m, percent: percentOf(m.items) }));
