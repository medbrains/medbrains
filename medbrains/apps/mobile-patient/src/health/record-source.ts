/**
 * `RecordSource` — the seam that makes the app sellable to somebody with no
 * hospital.
 *
 * The engagement core (daily brief, streaks, trends, reminders) consumes this
 * and never imports a source. That is the whole architectural rule: linking a
 * hospital record, reading HealthKit, or pairing a device are each an added
 * implementation of this interface rather than a rewrite of the app.
 *
 * Sources are read-only except `LocalSource`. A linked chart is the
 * clinician's, and the companion has no business writing to it — the write
 * paths on the server refuse it anyway, and a hopeful write that 403s at the
 * bedside is worse than no button.
 */

import type { HealthRecord } from "./types.js";

export interface RecordSource {
  /** Stable id, used to attribute rows in the UI and to dedupe on merge. */
  readonly id: SourceId;
  /** Shown to the user — "Typed by you", "Apollo Hospital". */
  readonly label: string;
  /**
   * Everything this source knows.
   *
   * Bounded by the source, not the caller: a chart with ten years of history
   * must not arrive whole on a phone. Each implementation documents its window.
   */
  load(): Promise<HealthRecord>;
}

export type SourceId = "local" | "portal" | "wearable" | "device";

/** A source that also accepts what the person types. Only `local` is one. */
export interface WritableRecordSource extends RecordSource {
  save(record: HealthRecord): Promise<void>;
}

export function isWritable(source: RecordSource): source is WritableRecordSource {
  return typeof (source as WritableRecordSource).save === "function";
}

/**
 * Merge sources into the one record the UI reads.
 *
 * Later sources win on id collision, so the caller orders by trust: local
 * first, then the chart, so a clinician's medication list overrides a
 * half-remembered one the person typed. Order is the policy; this function
 * only applies it.
 *
 * Linear in total rows, one Map per collection — the phone should not pay for
 * a nested scan just because two sources are connected.
 */
export function mergeRecords(records: readonly HealthRecord[]): HealthRecord {
  const medications = new Map<string, HealthRecord["medications"][number]>();
  const adherence = new Map<string, HealthRecord["adherence"][number]>();
  const observations = new Map<string, HealthRecord["observations"][number]>();
  const goals = new Map<string, HealthRecord["goals"][number]>();

  for (const record of records) {
    for (const item of record.medications) medications.set(item.id, item);
    for (const item of record.adherence) adherence.set(item.id, item);
    for (const item of record.observations) observations.set(item.id, item);
    for (const item of record.goals) goals.set(item.id, item);
  }

  return {
    medications: [...medications.values()],
    adherence: [...adherence.values()],
    observations: [...observations.values()],
    goals: [...goals.values()],
  };
}

/**
 * Observations are the only collection that grows on its own — a wearable
 * writes steps and sleep every day forever. Newest first, then truncated, so
 * the cap drops the oldest rather than whatever happened to be last in the
 * array (`docs/DEVICE-CONSTRAINED-RULES.md`: bound everything).
 *
 * 2,000 rows is roughly two years of daily weight-and-steps, or six months of
 * checking blood pressure twice a day. Longer history belongs to a linked
 * chart, not to a phone.
 */
export const MAX_OBSERVATIONS = 2000;

export function boundObservations(
  observations: readonly HealthRecord["observations"][number][],
): HealthRecord["observations"][number][] {
  return [...observations]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, MAX_OBSERVATIONS);
}
