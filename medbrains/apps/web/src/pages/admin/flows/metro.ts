/**
 * The metro map's pure logic: which stations a switch setting routes
 * through, where each station sits, and which lines are drawn how. The
 * server is the authority (it validates and runs the flow); this mirrors it
 * so the map redraws the instant a switch flips.
 */
import type { FlowClause, FlowStation, FlowSwitches } from "@medbrains/types";

/** Every clause entry holds — equality, as the library flows use it. */
export function clauseHolds(clause: FlowClause, values: FlowSwitches): boolean {
  if (!clause) return true;
  return Object.entries(clause).every(([k, v]) => values[k] === v);
}

export function onRoute(station: FlowStation, switches: FlowSwitches): boolean {
  return clauseHolds(station.switch_when, switches);
}

/** The station keys a switch setting routes through, in order. */
export function routeKeys(stations: FlowStation[], switches: FlowSwitches): string[] {
  return stations.filter((s) => onRoute(s, switches)).map((s) => s.key);
}

export interface Placement {
  key: string;
  /** Order along the line. */
  column: number;
  /** 0 is the main line; each branch gets its own lane below it. */
  lane: number;
}

/** Column = order, lane = branch. Computed, never dragged. */
export function layoutMetro(stations: FlowStation[]): Placement[] {
  const lanes: string[] = [];
  return stations.map((s, column) => {
    if (s.lane && !lanes.includes(s.lane)) lanes.push(s.lane);
    return { key: s.key, column, lane: s.lane ? lanes.indexOf(s.lane) + 1 : 0 };
  });
}

export type LineKind = "active" | "idle" | "ghost";

export interface Line {
  from: string;
  to: string;
  kind: LineKind;
}

function pairs(keys: string[]): [string, string][] {
  return keys.slice(1).map((k, i) => [keys[i] as string, k]);
}

/** The nearest main-line station before (dir -1) or after (dir 1) index i. */
function mainNeighbour(stations: FlowStation[], i: number, dir: 1 | -1): string | null {
  for (let j = i + dir; j >= 0 && j < stations.length; j += dir) {
    const s = stations[j];
    if (s && !s.lane) return s.key;
  }
  return null;
}

/**
 * Lines to draw: the active route solid, branches not taken dotted, and —
 * when a change is proposed — the old route as a ghost wherever it differs.
 */
export function metroLines(
  stations: FlowStation[],
  switches: FlowSwitches,
  ghost: FlowSwitches | null,
): Line[] {
  const active = pairs(routeKeys(stations, switches));
  const seen = new Set(active.map(([a, b]) => `${a}>${b}`));
  const lines: Line[] = active.map(([from, to]) => ({ from, to, kind: "active" }));
  stations.forEach((s, i) => {
    if (onRoute(s, switches)) return;
    const before = mainNeighbour(stations, i, -1);
    const after = mainNeighbour(stations, i, 1);
    if (before) lines.push({ from: before, to: s.key, kind: "idle" });
    if (after) lines.push({ from: s.key, to: after, kind: "idle" });
  });
  if (ghost) {
    for (const [from, to] of pairs(routeKeys(stations, ghost))) {
      if (!seen.has(`${from}>${to}`)) lines.push({ from, to, kind: "ghost" });
    }
  }
  return lines;
}

function audience(s: FlowStation): string {
  return s.fact_when ? "insurance patients" : "every patient";
}

/** Plain sentences for a route change, announced when a switch flips. */
export function describeRouteChange(
  stations: FlowStation[],
  before: FlowSwitches,
  after: FlowSwitches,
): string[] {
  return stations.flatMap((s) => {
    const was = onRoute(s, before);
    const now = onRoute(s, after);
    if (was === now) return [];
    return [`Route now ${now ? "stops at" : "skips"} ${s.name} for ${audience(s)}`];
  });
}

/** The station keys a switch decides (to highlight them on the map). */
export function stationsForSwitch(stations: FlowStation[], switchKey: string): string[] {
  return stations.filter((s) => s.switch_when && switchKey in s.switch_when).map((s) => s.key);
}

/** The switch keys whose value differs between two settings. */
export function changedKeys(before: FlowSwitches, after: FlowSwitches): string[] {
  return Object.keys(after).filter((k) => before[k] !== after[k]);
}
