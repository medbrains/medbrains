import { describe, expect, it } from "vitest";
import {
  type BreakdownDraft,
  checkBreakdown,
  needsImmediateSwap,
  PRIORITY_MEANING,
} from "./breakdown.js";

const draft = (over: Partial<BreakdownDraft> = {}): BreakdownDraft => ({
  equipmentId: "eq-1",
  priority: "medium",
  description: "Infusion pump alarms and stops mid-run",
  ...over,
});

describe("checkBreakdown", () => {
  it("accepts a described fault against known equipment", () => {
    expect(checkBreakdown(draft()).canSubmit).toBe(true);
  });

  it("refuses a report with no equipment", () => {
    // Otherwise the report cannot be routed to anything.
    expect(checkBreakdown(draft({ equipmentId: null })).equipment).toBeDefined();
  });

  it("refuses 'not working' as a description", () => {
    // An engineer arriving to that has to diagnose from scratch, which is the
    // difference between swapping a device and extending its downtime.
    const problems = checkBreakdown(draft({ description: "broken" }));
    expect(problems.description).toBeDefined();
    expect(problems.canSubmit).toBe(false);
  });

  it("counts trimmed length, not raw whitespace", () => {
    expect(checkBreakdown(draft({ description: "        " })).description).toBeDefined();
  });
});

describe("needsImmediateSwap", () => {
  it("is true only for critical", () => {
    // Critical is defined as 'a patient is on it right now'.
    expect(needsImmediateSwap("critical")).toBe(true);
    expect(needsImmediateSwap("high")).toBe(false);
    expect(needsImmediateSwap("low")).toBe(false);
  });
});

describe("PRIORITY_MEANING", () => {
  it("describes urgency in terms of the patient, not the asset", () => {
    // A nurse knows whether someone is depending on the device; they do not
    // necessarily know its inventory criticality, and guessing produces a
    // field nobody can trust.
    expect(PRIORITY_MEANING.critical).toBe("A patient is on it right now");
    expect(Object.keys(PRIORITY_MEANING)).toHaveLength(4);
  });
});
