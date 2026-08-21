/**
 * Two decisions are encoded here, and each test fails if the decision is
 * reversed rather than merely if the code changes shape.
 *
 *   1. On a collision the LATER source wins, because the caller orders by
 *      trust — local first, then the linked chart. A clinician's medication
 *      list must override a half-remembered one the person typed.
 *   2. The observation cap drops the OLDEST, not whatever happened to be at
 *      the end of the array. A cap that trims the newest would silently hide
 *      today's reading, which is the one the person opened the app to see.
 */

import { describe, expect, it } from "vitest";
import { boundObservations, MAX_OBSERVATIONS, mergeRecords } from "./record-source.js";
import type { HealthRecord, MedicationPlan, Observation } from "./types.js";
import { EMPTY_RECORD } from "./types.js";

function medication(
  id: string,
  name: string,
  provenance: MedicationPlan["provenance"],
): MedicationPlan {
  return { id, name, instructions: "", times: [], startedOn: "2026-01-01", provenance };
}

function observation(id: string, recordedAt: string): Observation {
  return { id, kind: "weight", value: 70, unit: "kg", recordedAt, provenance: "self" };
}

function record(partial: Partial<HealthRecord>): HealthRecord {
  return { ...EMPTY_RECORD, ...partial };
}

describe("mergeRecords", () => {
  it("lets the later source win, so a chart overrides what the person typed", () => {
    const typed = record({ medications: [medication("m1", "Metformin 500", "self")] });
    const chart = record({ medications: [medication("m1", "Metformin 1000", "record")] });

    const merged = mergeRecords([typed, chart]);

    expect(merged.medications).toHaveLength(1);
    expect(merged.medications[0]?.name).toBe("Metformin 1000");
    expect(merged.medications[0]?.provenance).toBe("record");
  });

  it("keeps entries that only one source knows about", () => {
    const typed = record({ medications: [medication("m1", "Vitamin D", "self")] });
    const chart = record({ medications: [medication("m2", "Amlodipine", "record")] });

    expect(mergeRecords([typed, chart]).medications).toHaveLength(2);
  });

  it("is the empty record when there are no sources", () => {
    expect(mergeRecords([])).toEqual(EMPTY_RECORD);
  });
});

describe("boundObservations", () => {
  it("drops the oldest, never the newest", () => {
    const overflow = Array.from({ length: MAX_OBSERVATIONS + 10 }, (_, index) =>
      // index 0 is the oldest day, so the last generated is the most recent
      observation(`o${index}`, `2020-01-01T00:00:${String(index % 60).padStart(2, "0")}Z`),
    );
    // make recency unambiguous rather than relying on the second field above
    const dated = overflow.map((item, index) => ({
      ...item,
      recordedAt: new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString(),
    }));

    const bounded = boundObservations(dated);

    expect(bounded).toHaveLength(MAX_OBSERVATIONS);
    expect(bounded[0]?.id).toBe(`o${dated.length - 1}`);
    expect(bounded.some((item) => item.id === "o0")).toBe(false);
  });

  it("leaves a short history alone apart from ordering it newest first", () => {
    const bounded = boundObservations([
      observation("old", "2026-01-01T00:00:00Z"),
      observation("new", "2026-06-01T00:00:00Z"),
    ]);

    expect(bounded.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
