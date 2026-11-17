import type { WorkItem, WorkResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { launcherService } from "@/services/launcher.service";

/** The work-counts query: what is waiting for me across my apps. */
export const WORK_QUERY_KEY = ["launcher", "work"] as const;

/**
 * My work counts, refreshed every minute while the tab is open and on return to it.
 * Push notifications stay the urgent channel; this is the summary.
 */
export function useMyWork() {
  return useQuery({
    queryKey: WORK_QUERY_KEY,
    queryFn: launcherService.getMyWork,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Whether an item has something to show: a count above 0, or a failure to say so. */
export function hasSomething(item: WorkItem): boolean {
  return item.status === "failed" || (item.count ?? 0) > 0;
}

/**
 * The items I may see, without those whose brick the hospital switched off: the server
 * already leaves them out, and this keeps a stale answer from showing a door that refuses.
 */
export function visibleItems(work: WorkResponse, disabledModules: ReadonlySet<string>) {
  return work.items.filter((item) => !(item.brick && disabledModules.has(item.brick)));
}

/** The safety items to show in "Needs you now": critical, and either waiting or unreadable. */
export function needsNow(items: readonly WorkItem[]): WorkItem[] {
  return items.filter((item) => item.section === "now" && hasSomething(item));
}

/** What "Waiting for you" shows, decided in one place so the states cannot disagree. */
export type WaitingState =
  | { kind: "hidden" }
  | { kind: "nothing" }
  | { kind: "items"; items: WorkItem[]; anyFailed: boolean };

/**
 * No items I may see hides the section; every item loaded and all at 0 says "Nothing
 * waiting for you". Any failure keeps that line away, because 0 is not known.
 */
export function waitingState(items: readonly WorkItem[]): WaitingState {
  const waiting = items.filter((item) => item.section === "waiting");
  if (waiting.length === 0) return { kind: "hidden" };
  const shown = waiting.filter(hasSomething);
  if (shown.length === 0) return { kind: "nothing" };
  return { kind: "items", items: shown, anyFailed: shown.some((i) => i.status === "failed") };
}

/** The count as shown: "99+" when the server stopped counting, nothing when it failed. */
export function countLabel(item: WorkItem): string | undefined {
  if (item.count === null) return undefined;
  return item.capped ? `${item.count}+` : String(item.count);
}

/** The work item each app tile shows: the first loaded, non-zero item of that brick. */
export function itemsByBrick(items: readonly WorkItem[]): Map<string, WorkItem> {
  const byBrick = new Map<string, WorkItem>();
  for (const item of items) {
    if (item.brick && item.status === "ok" && (item.count ?? 0) > 0 && !byBrick.has(item.brick)) {
      byBrick.set(item.brick, item);
    }
  }
  return byBrick;
}

/** Whole minutes from `iso` to `now`, never below 0 (a clock a little ahead reads "just now"). */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

/** "today 17:40", "yesterday 17:40" or "12 Nov 17:40", in the browser's zone and language. */
export function dayAndTime(iso: string, now: Date, locale?: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const days = Math.round(
    (new Date(now.toDateString()).getTime() - new Date(at.toDateString()).getTime()) / 86_400_000,
  );
  const day =
    days === 0 || days === 1
      ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day")
      : at.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${day} ${time}`;
}

/** Morning before noon, afternoon before five, evening after: the greeting's part of day. */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  return hour < 17 ? "afternoon" : "evening";
}
