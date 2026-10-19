import { describe, expect, it } from "vitest";
import {
  CARE_PLAN_DEFAULTS,
  carePlanSchema,
  interventionLines,
  NURSING_ASSESSMENT_DEFAULTS,
  nursingAssessmentSchema,
  toCarePlanRequest,
  toNursingAssessmentRequest,
} from "./nursing-forms";

describe("nursing admission assessment form", () => {
  it("requires the general appearance and a pain score in range", () => {
    expect(nursingAssessmentSchema.safeParse(NURSING_ASSESSMENT_DEFAULTS).success).toBe(false);
    const filled = { ...NURSING_ASSESSMENT_DEFAULTS, general_appearance: "Comfortable" };
    expect(nursingAssessmentSchema.safeParse(filled).success).toBe(true);
    expect(nursingAssessmentSchema.safeParse({ ...filled, pain_score: 11 }).success).toBe(false);
  });

  it("maps each section into its stored JSON and drops empty text", () => {
    const req = toNursingAssessmentRequest({
      ...NURSING_ASSESSMENT_DEFAULTS,
      general_appearance: "Comfortable",
      pain_score: 6,
      pain_location: "left hip",
      allergies: "Penicillin",
    });
    expect(req.pain_assessment).toEqual({ score: 6, location: "left hip" });
    expect(req.allergies).toBe("Penicillin");
    expect(req.medications_on_admission).toBeUndefined();
  });
});

describe("care plan form", () => {
  it("needs a nursing diagnosis", () => {
    expect(carePlanSchema.safeParse(CARE_PLAN_DEFAULTS).success).toBe(false);
  });

  it("stores one intervention per non-blank line", () => {
    const req = toCarePlanRequest({
      ...CARE_PLAN_DEFAULTS,
      nursing_diagnosis: "Acute pain",
      interventions: "Pain score 4-hourly\n\n  Analgesia as charted  ",
    });
    expect(req.interventions).toEqual(["Pain score 4-hourly", "Analgesia as charted"]);
    expect(req.goals).toBeUndefined();
  });

  it("reads stored interventions back, ignoring non-text entries", () => {
    expect(interventionLines(["a", 2, "b"])).toEqual(["a", "b"]);
    expect(interventionLines({})).toEqual([]);
  });
});
