/**
 * MedBrains Flow map state, with no React in it: which band each zone is in
 * under each overlay, where each zone sits on the schematic grid, what the
 * map shows at a moment in today's timeline, and the one-line text summary
 * that the canvas reads out. Pure, so it is unit-tested.
 *
 * `null` is "unknown" everywhere: a source that could not be read, or a
 * forecast that does not predict waits. It is never drawn as zero.
 */
import type {
  FlowForecast,
  FlowHistoryPoint,
  FlowRecommendation,
  FlowZoneLive,
} from "@medbrains/types";
import type { FloorMapZone } from "@/components/ui";

export type FlowOverlay = "crowd" | "wait" | "staff" | "bottleneck";

export const OVERLAYS: { value: FlowOverlay; label: string }[] = [
  { value: "crowd", label: "Crowd" },
  { value: "wait", label: "Wait" },
  { value: "staff", label: "Staff load" },
  { value: "bottleneck", label: "Bottleneck" },
];

export const BAND_LABELS = ["Quiet", "Moderate", "Busy", "Crowded", "Over limit"] as const;

/** Mirrors the server's `DEFAULT_TARGET_WAIT_MINUTES` [inferred]. */
export const DEFAULT_TARGET_WAIT = 15;
/** People one member of staff can look after before the zone reads strained. [inferred] */
const PEOPLE_PER_STAFF_STEPS = [10, 20, 30, 40];
/** A ratio to a limit, to a band: under half, under 80%, to the limit, over it, over capacity. */
function ratioBand(ratio: number, overCapacity: boolean): number {
  if (overCapacity) return 4;
  if (ratio < 0.5) return 0;
  if (ratio < 0.8) return 1;
  return ratio <= 1 ? 2 : 3;
}

export function crowdBand(z: FlowZoneLive): number | null {
  if (z.people_est === null) return null;
  const limit = z.comfort_limit ?? z.capacity;
  if (limit === null) return z.people_est > 0 ? 1 : 0;
  const overCapacity = z.capacity !== null && z.people_est > z.capacity;
  return ratioBand(z.people_est / limit, overCapacity);
}

export function waitBand(z: FlowZoneLive): number | null {
  if (z.wait_minutes === null) return null;
  const target = z.goal_wait_minutes ?? DEFAULT_TARGET_WAIT;
  const ratio = z.wait_minutes / target;
  return ratio > 1.5 ? 4 : ratioBand(ratio, false);
}

export function staffBand(z: FlowZoneLive): number | null {
  if (z.people_est === null || z.staff === null) return null;
  if (z.people_est === 0) return 0;
  if (z.staff === 0) return 4;
  const perStaff = z.people_est / z.staff;
  const idx = PEOPLE_PER_STAFF_STEPS.findIndex((step) => perStaff < step);
  return idx === -1 ? 4 : idx;
}

/** Stuck (people waiting, nobody called) or advice open is the worst; past target is busy. */
export function bottleneckBand(z: FlowZoneLive, advised: ReadonlySet<string>): number | null {
  if (z.waiting === null) return null;
  if (advised.has(z.location_id)) return 4;
  if (z.waiting > 0 && z.served_30m === 0) return 4;
  const wait = waitBand(z);
  return wait !== null && wait >= 3 ? 3 : z.waiting > 0 ? 1 : 0;
}

export function bandFor(
  overlay: FlowOverlay,
  z: FlowZoneLive,
  advised: ReadonlySet<string>,
): number | null {
  switch (overlay) {
    case "crowd":
      return crowdBand(z);
    case "wait":
      return waitBand(z);
    case "staff":
      return staffBand(z);
    case "bottleneck":
      return bottleneckBand(z, advised);
  }
}

/** The overlay's headline number for a zone, written out. */
export function metricText(overlay: FlowOverlay, z: FlowZoneLive): string {
  switch (overlay) {
    case "crowd":
      return z.people_est === null ? "Unknown" : `${z.people_est} est.`;
    case "wait":
      return z.wait_minutes === null ? "Wait unknown" : `~${Math.round(z.wait_minutes)} min wait`;
    case "staff":
      if (z.staff === null) return "Staff unknown";
      return z.staff === 0 ? "No staff on duty" : `${z.staff} staff on duty`;
    case "bottleneck":
      if (z.waiting === null) return "Queue unknown";
      if (z.waiting > 0 && z.served_30m === 0) return "Queue not moving";
      return `${z.waiting} waiting`;
  }
}

export interface GridCell {
  row: number;
  col: number;
}

/**
 * Zones with a place keep it; the rest fill the free cells in reading order,
 * at least three to a row, so a floor nobody has laid out still reads.
 */
export function layoutGrid(zones: FlowZoneLive[]): Map<string, GridCell> {
  const placed = new Map<string, GridCell>();
  const taken = new Set<string>();
  for (const z of zones) {
    if (z.grid_row !== null && z.grid_col !== null && !taken.has(`${z.grid_row}:${z.grid_col}`)) {
      placed.set(z.location_id, { row: z.grid_row, col: z.grid_col });
      taken.add(`${z.grid_row}:${z.grid_col}`);
    }
  }
  const cols = Math.max(3, ...[...placed.values()].map((c) => c.col));
  let cursor = 0;
  for (const z of zones) {
    if (placed.has(z.location_id)) continue;
    while (taken.has(`${Math.floor(cursor / cols) + 1}:${(cursor % cols) + 1}`)) cursor += 1;
    const cell = { row: Math.floor(cursor / cols) + 1, col: (cursor % cols) + 1 };
    placed.set(z.location_id, cell);
    taken.add(`${cell.row}:${cell.col}`);
  }
  return placed;
}

/** Each zone as the map and its table draw it under `overlay`. */
export function zoneViews(
  zones: FlowZoneLive[],
  overlay: FlowOverlay,
  recommendations: FlowRecommendation[],
): FloorMapZone[] {
  const advised = new Set(recommendations.map((r) => r.location_id));
  const grid = layoutGrid(zones);
  return zones.map((z) => {
    const band = bandFor(overlay, z, advised);
    const cell = grid.get(z.location_id) ?? { row: 1, col: 1 };
    return {
      id: z.location_id,
      name: z.name,
      row: cell.row,
      col: cell.col,
      band,
      bandLabel: band === null ? "Unknown" : (BAND_LABELS[band] ?? "Unknown"),
      metric: metricText(overlay, z),
      queue: z.waiting,
      staff: z.staff,
    };
  });
}

/** The canvas's text alternative: what a screen reader hears for the whole map. */
export function floorSummary(floor: string, views: FloorMapZone[]): string {
  const over = views.filter((v) => v.band !== null && v.band >= 4).map((v) => v.name);
  const unknown = views.filter((v) => v.band === null).length;
  const parts = [
    over.length === 0
      ? `${floor}: no zone over its limit`
      : `${floor}: ${over.length} ${over.length === 1 ? "zone" : "zones"} over limit: ${over.join(", ")}`,
  ];
  if (unknown > 0) parts.push(`${unknown} unknown`);
  return `${parts.join("; ")}.`;
}

export type Moment =
  | { kind: "live" }
  | { kind: "history"; at: string }
  | { kind: "forecast"; at: string };

/** One stop on the timeline slider. */
export interface TimelineStep {
  moment: Moment;
  label: string;
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/** Today's past steps, then now, then the forecast — in time order. */
export function timeline(
  history: FlowHistoryPoint[],
  forecast: FlowForecast | null,
): TimelineStep[] {
  const past = [...new Set(history.map((p) => p.at))].sort();
  const ahead = [...new Set((forecast?.points ?? []).map((p) => p.at))].sort();
  return [
    ...past.map((at) => ({ moment: { kind: "history", at } as Moment, label: timeLabel(at) })),
    { moment: { kind: "live" }, label: "Now" },
    ...ahead.slice(1).map((at) => ({
      moment: { kind: "forecast", at } as Moment,
      label: `${timeLabel(at)} (forecast)`,
    })),
  ];
}

const UNKNOWN_COUNTS = {
  people_est: null,
  patients: null,
  waiting: null,
  checked_in: null,
  visitors: null,
  staff: null,
  wait_minutes: null,
  served_30m: null,
  open_counters: null,
} as const;

/** The zones as they were (or are forecast to be) at `moment`. */
export function zonesAt(
  zones: FlowZoneLive[],
  moment: Moment,
  history: FlowHistoryPoint[],
  forecast: FlowForecast | null,
): FlowZoneLive[] {
  if (moment.kind === "live") return zones;
  if (moment.kind === "history") {
    const at = new Map(
      history.filter((p) => p.at === moment.at).map((p) => [p.location_id, p] as const),
    );
    return zones.map((z) => {
      const p = at.get(z.location_id);
      return {
        ...z,
        ...UNKNOWN_COUNTS,
        people_est: p?.people_est == null ? null : Math.round(p.people_est),
        waiting: p?.waiting == null ? null : Math.round(p.waiting),
        wait_minutes: p?.wait_minutes ?? null,
        counters: [],
      };
    });
  }
  const at = new Map(
    (forecast?.points ?? [])
      .filter((p) => p.at === moment.at)
      .map((p) => [p.location_id, p] as const),
  );
  return zones.map((z) => ({
    ...z,
    ...UNKNOWN_COUNTS,
    people_est: at.get(z.location_id)?.people_est ?? null,
    counters: [],
  }));
}
