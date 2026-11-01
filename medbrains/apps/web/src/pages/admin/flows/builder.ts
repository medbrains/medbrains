/**
 * The track builder's pure logic: placing a catalogue block, moving and
 * removing stations, branching, and turning the server's checks into the
 * checks panel. The server re-checks everything; nothing here decides
 * whether a track is safe.
 */
import type {
  FlowBlock,
  FlowCheck,
  FlowClause,
  FlowDraft,
  FlowStation,
  FlowStationKind,
} from "@medbrains/types";

function kindOf(block: FlowBlock): FlowStationKind {
  if (block.kind === "signal") return { type: "signal", signal: block.code };
  if (block.kind === "task") return { type: "task", task: block.code };
  return { type: "action", action: block.code };
}

/** A key no station on the track has yet, from the block's code. */
export function newKey(track: FlowStation[], block: FlowBlock): string {
  const base = (block.code.split(".").pop() ?? "station").replace(/[^a-z0-9_]/g, "_").slice(0, 32);
  const taken = new Set(track.map((s) => s.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** The track with `block` placed so it becomes the station at `index`. */
export function insertBlock(track: FlowStation[], index: number, block: FlowBlock): FlowStation[] {
  const station: FlowStation = {
    key: newKey(track, block),
    name: block.name,
    stage: block.stage,
    kind: kindOf(block),
    lane: null,
    switch_when: null,
    fact_when: null,
    sla_minutes: block.sla_minutes,
    locked: false,
    holder: block.holder,
    holder_role: null,
    required_by: null,
    path: "",
  };
  const at = Math.max(0, Math.min(index, track.length));
  return [...track.slice(0, at), station, ...track.slice(at)];
}

/** The track with station `key` moved to `index` (drag along the line). */
export function moveTo(track: FlowStation[], key: string, index: number): FlowStation[] {
  const from = track.findIndex((s) => s.key === key);
  if (from < 0) return track;
  const rest = track.filter((s) => s.key !== key);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), track[from] as FlowStation, ...rest.slice(at)];
}

/** One step earlier (-1) or later (1): the keyboard way to reorder. */
export function moveBy(track: FlowStation[], key: string, delta: -1 | 1): FlowStation[] {
  const from = track.findIndex((s) => s.key === key);
  return from < 0 ? track : moveTo(track, key, from + delta);
}

/** Why a station cannot be removed, or null when it can. */
export function removeBlockedReason(station: FlowStation): string | null {
  return station.locked
    ? `${station.name} is a required safety signal: ${station.required_by ?? "required by law or safety"}`
    : null;
}

export function removeStation(track: FlowStation[], key: string): FlowStation[] {
  const station = track.find((s) => s.key === key);
  if (!station || removeBlockedReason(station)) return track;
  return track.filter((s) => s.key !== key);
}

/** Put a station on a branch (a lane only some patients take), or back on the main line. */
export function setBranch(
  track: FlowStation[],
  key: string,
  lane: string | null,
  clause: FlowClause,
): FlowStation[] {
  return track.map((s) =>
    s.key === key ? { ...s, lane: clause ? lane || "Branch" : null, fact_when: clause } : s,
  );
}

export function updateStation(
  track: FlowStation[],
  key: string,
  patch: Partial<Pick<FlowStation, "name" | "stage" | "sla_minutes" | "holder_role">>,
): FlowStation[] {
  return track.map((s) => (s.key === key ? { ...s, ...patch } : s));
}

/** The checks panel's order: the safety rules first, the dry run last. */
const ORDER: FlowCheck["rule"][] = [
  "invariants",
  "locked",
  "ends",
  "conditions",
  "staffed",
  "dry_run",
];

export interface CheckLine {
  rule: FlowCheck["rule"];
  pass: boolean;
  /** The verdict in words, never colour alone. */
  verdict: "Passes" | "Fails";
  sentence: string;
  problems: string[];
  /** Stations to highlight when the line is chosen. */
  stations: string[];
}

export function checkLines(checks: FlowCheck[]): CheckLine[] {
  return [...checks]
    .sort((a, b) => ORDER.indexOf(a.rule) - ORDER.indexOf(b.rule))
    .map((c) => ({
      rule: c.rule,
      pass: c.pass,
      verdict: c.pass ? "Passes" : "Fails",
      sentence: c.sentence,
      problems: c.problems,
      stations: c.stations,
    }));
}

export interface ProposeState {
  ok: boolean;
  /** Why Propose is disabled, in words. */
  reason: string | null;
}

/** Propose is enabled only for a saved, current, dry-run draft that passes every check. */
export function proposeState(args: {
  draft: FlowDraft | null;
  checks: FlowCheck[];
  unsaved: boolean;
}): ProposeState {
  const { draft, checks, unsaved } = args;
  if (!draft) return { ok: false, reason: "Change the track first; there is no draft." };
  if (unsaved) return { ok: false, reason: "Wait for the draft to save." };
  if (draft.stale) {
    return { ok: false, reason: "Another change was published since this draft started." };
  }
  if (draft.dry_run_revision !== draft.revision) {
    return { ok: false, reason: "Run the test drive on this version of the draft." };
  }
  const failing = checks.filter((c) => !c.pass).length;
  if (failing > 0) {
    return { ok: false, reason: `${failing} ${failing === 1 ? "check fails" : "checks fail"}.` };
  }
  return { ok: true, reason: null };
}
