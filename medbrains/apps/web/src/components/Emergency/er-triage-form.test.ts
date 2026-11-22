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

  it("refuses an impossible reading in words that name the field and its range", () => {
    const result = erTriageSchema.safeParse({
      triage_level: "urgent",
      spo2: 150,
      pulse_rate: 900,
      gcs_score: 99,
      respiratory_rate: -4,
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Pulse must be between 0 and 300",
      "Respiratory rate must be between 0 and 80",
      "SpO₂ must be between 0 and 100",
      "GCS must be between 3 and 15",
    ]);
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
