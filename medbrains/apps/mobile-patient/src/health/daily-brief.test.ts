/**
 * The decisions under test, each of which is a product judgement rather than
 * an implementation detail:
 *
 *   · no scheduled doses reads as `null`, never 0% — a person who takes no
 *     regular medication should not be shown a zero
 *   · the streak ends YESTERDAY, so it does not break every evening merely
 *     because the last dose is not due yet
 *   · confidence is stated, because a score with no confidence is a guess
 *     wearing a number
 *   · every verdict is an observation, never an instruction
 */

import { describe, expect, it } from "vitest";
import {
  adherenceOver,
  buildDailyBrief,
  confidenceFrom,
  streakEndingYesterday,
} from "./daily-brief.js";
import type { AdherenceEvent, HealthRecord, MedicationPlan } from "./types.js";
import { EMPTY_RECORD } from "./types.js";

const NOW = new Date("2026-06-15T09:00:00.000Z");

function plan(over: Partial<MedicationPlan> = {}): MedicationPlan {
  return {
    id: "p1",
    name: "Metformin 500",
    instructions: "after food",
    times: ["08:00", "20:00"],
    startedOn: "2026-01-01",
    provenance: "self",
    ...over,
  };
}

function dose(
  day: string,
  time: string,
  status: AdherenceEvent["status"],
  planId = "p1",
): AdherenceEvent {
  return { id: `${planId}-${day}-${time}`, planId, scheduledFor: `${day}T${time}:00.000Z`, status };
}

function record(over: Partial<HealthRecord>): HealthRecord {
  return { ...EMPTY_RECORD, ...over };
}

describe("buildDailyBrief", () => {
  it("lists today's doses in time order, marking unanswered ones due", () => {
    const brief = buildDailyBrief(record({ medications: [plan()] }), NOW);
    expect(brief.slots.map((s) => s.time)).toEqual(["08:00", "20:00"]);
    expect(brief.slots.every((s) => s.status === "due")).toBe(true);
  });

  it("carries an answer already given for a slot", () => {
    const brief = buildDailyBrief(
      record({ medications: [plan()], adherence: [dose("2026-06-15", "08:00", "taken")] }),
      NOW,
    );
    expect(brief.slots[0]?.status).toBe("taken");
    expect(brief.slots[1]?.status).toBe("due");
  });

  it("omits a plan that has not started or has ended", () => {
    const future = plan({ id: "later", startedOn: "2026-12-01" });
    const finished = plan({ id: "done", endsOn: "2026-02-01" });
    expect(buildDailyBrief(record({ medications: [future, finished] }), NOW).slots).toHaveLength(0);
  });

  it("says nothing is scheduled rather than inventing a score", () => {
    const brief = buildDailyBrief(EMPTY_RECORD, NOW);
    expect(brief.verdict).toBe("Nothing scheduled today.");
    expect(brief.adherencePercent).toBeNull();
  });

  it("never issues an instruction — every verdict is an observation", () => {
    const briefs = [
      buildDailyBrief(EMPTY_RECORD, NOW),
      buildDailyBrief(record({ medications: [plan()] }), NOW),
      buildDailyBrief(
        record({
          medications: [plan()],
          adherence: [dose("2026-06-15", "08:00", "taken"), dose("2026-06-15", "20:00", "taken")],
        }),
        NOW,
      ),
    ];
    for (const brief of briefs) {
      expect(brief.verdict).not.toMatch(
        /\byou should\b|\bsee a doctor\b|\btake\b.*\bnow\b|\bincrease\b|\breduce\b/i,
      );
    }
  });
});

describe("adherenceOver", () => {
  it("is null when nothing was scheduled, which is not the same as zero", () => {
    expect(adherenceOver(EMPTY_RECORD, NOW, 7)).toBeNull();
  });

  it("counts taken against scheduled inside the window only", () => {
    const inside = [dose("2026-06-14", "08:00", "taken"), dose("2026-06-14", "20:00", "missed")];
    const outside = [dose("2026-01-01", "08:00", "missed")];
    expect(adherenceOver(record({ adherence: [...inside, ...outside] }), NOW, 7)).toBe(50);
  });
});

describe("streakEndingYesterday", () => {
  it("counts back from yesterday, not today", () => {
    const adherence = [
      dose("2026-06-14", "08:00", "taken"),
      dose("2026-06-13", "08:00", "taken"),
      dose("2026-06-12", "08:00", "missed"),
    ];
    expect(streakEndingYesterday(record({ adherence }), NOW)).toBe(2);
  });

  it("does not break merely because today is still in progress", () => {
    const adherence = [
      dose("2026-06-15", "08:00", "due" as AdherenceEvent["status"]),
      dose("2026-06-14", "08:00", "taken"),
    ];
    expect(streakEndingYesterday(record({ adherence }), NOW)).toBe(1);
  });

  it("is zero with no history at all", () => {
    expect(streakEndingYesterday(EMPTY_RECORD, NOW)).toBe(0);
  });
});

describe("confidenceFrom", () => {
  it("starts at calibrating and says so rather than showing a confident score", () => {
    expect(confidenceFrom(EMPTY_RECORD, NOW)).toBe("calibrating");
    expect(confidenceFrom(record({ adherence: [dose("2026-06-13", "08:00", "taken")] }), NOW)).toBe(
      "calibrating",
    );
  });

  it("builds, then establishes, as history accumulates", () => {
    expect(confidenceFrom(record({ adherence: [dose("2026-06-01", "08:00", "taken")] }), NOW)).toBe(
      "building",
    );
    expect(confidenceFrom(record({ adherence: [dose("2026-04-01", "08:00", "taken")] }), NOW)).toBe(
      "established",
    );
  });
});
