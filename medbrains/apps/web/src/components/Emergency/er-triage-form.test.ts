import { describe, expect, it } from "vitest";
import { erTriageSchema, toCreateTriageRequest } from "./er-triage-form";

describe("erTriageSchema", () => {
  it("needs a triage level before anything is saved", () => {
    const result = erTriageSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["triage_level"]);
  });

  it("refuses a half-entered or swapped blood pressure", () => {
    const half = erTriageSchema.safeParse({ triage_level: "urgent", blood_pressure_systolic: 130 });
    expect(half.error?.issues[0]?.path).toEqual(["blood_pressure_diastolic"]);
    const swapped = erTriageSchema.safeParse({
      triage_level: "urgent",
      blood_pressure_systolic: 70,
      blood_pressure_diastolic: 110,
    });
    expect(swapped.success).toBe(false);
  });

  it("holds pain to 0–10 and GCS to 3–15", () => {
    expect(erTriageSchema.safeParse({ triage_level: "urgent", pain_score: 11 }).success).toBe(
      false,
    );
    expect(erTriageSchema.safeParse({ triage_level: "urgent", gcs_score: 2 }).success).toBe(false);
  });
});

describe("toCreateTriageRequest", () => {
  it("sends both BP numbers, ESI, and drops blank text", () => {
    const values = erTriageSchema.parse({
      triage_level: "emergent",
      chief_complaint: "  ",
      blood_pressure_systolic: 182,
      blood_pressure_diastolic: 121,
      pain_score: 6,
    });
    expect(toCreateTriageRequest(values)).toMatchObject({
      triage_level: "emergent",
      triage_system: "ESI",
      chief_complaint: undefined,
      blood_pressure_systolic: 182,
      blood_pressure_diastolic: 121,
      pain_score: 6,
    });
  });
});
