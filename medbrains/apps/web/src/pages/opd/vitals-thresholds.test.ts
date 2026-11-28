import { describe, expect, it } from "vitest";
import {
  ADULT_VITAL_BANDS,
  bloodPressureGrade,
  gradeLabel,
  gradeTone,
  gradeVital,
} from "./vitals-thresholds";

describe("bloodPressureGrade", () => {
  /**
   * The bug this was written for. The badge used `systolic > 140`, so a
   * reading of exactly 140 painted as normal — while the camp analytics
   * counted the same reading as stage 2 ("476 showed stage 2 elevation
   * >=140/90"). Two parts of the product disagreed about the same patient.
   *
   * Clinicians round to the nearest 5 or 10, so the boundary is not an edge
   * case here; it is one of the commonest values recorded.
   */
  it("treats exactly 140 systolic as high, not normal", () => {
    expect(bloodPressureGrade(140, 85)).toBe("high");
    expect(bloodPressureGrade(139, 85)).toBe("normal");
  });

  /**
   * The larger miss: diastolic was never consulted. 130/95 is hypertensive on
   * the diastolic alone and rendered as a normal blue pill.
   */
  it("flags a high diastolic even when systolic looks fine", () => {
    expect(bloodPressureGrade(130, 95)).toBe("high");
    expect(bloodPressureGrade(130, 90)).toBe("high");
    expect(bloodPressureGrade(130, 89)).toBe("normal");
  });

  /** 70/40 was amber with no word. NEWS2's red band is a systolic of 90 or less, inclusive. */
  it("grades a systolic of 90 or less as critical low", () => {
    expect(bloodPressureGrade(70, 40)).toBe("critical_low");
    expect(bloodPressureGrade(90, 60)).toBe("critical_low");
    expect(bloodPressureGrade(91, 60)).toBe("normal");
  });

  it("grades a hypertensive crisis as critical high, on either number", () => {
    expect(bloodPressureGrade(180, 100)).toBe("critical_high");
    expect(bloodPressureGrade(150, 120)).toBe("critical_high");
    expect(bloodPressureGrade(179, 119)).toBe("high");
  });

  /** Critical beats high when a reading is somehow both. */
  it("prefers critical low over a high diastolic", () => {
    expect(bloodPressureGrade(85, 95)).toBe("critical_low");
  });

  /**
   * 273 of 1,542 real registrations have no systolic. A missing reading is
   * not a normal reading, and it is certainly not 0 — coerced to a number, a
   * blank field would read as profound hypotension and flag every unmeasured
   * patient.
   */
  it("says nothing about a patient whose pressure was never taken", () => {
    expect(bloodPressureGrade(null, null)).toBe("normal");
    expect(bloodPressureGrade(undefined, undefined)).toBe("normal");
    expect(bloodPressureGrade("" as unknown as number, "" as unknown as number)).toBe("normal");
  });

  /** Half a reading is still a reading — flag on the half that exists. */
  it("uses whichever number was recorded", () => {
    expect(bloodPressureGrade(160, null)).toBe("high");
    expect(bloodPressureGrade(null, 100)).toBe("high");
    expect(bloodPressureGrade(120, null)).toBe("normal");
  });

  it("ignores a value that will not parse rather than trusting it", () => {
    expect(bloodPressureGrade("abc" as unknown as number, 80)).toBe("normal");
  });
});

describe("gradeVital", () => {
  /** The entry form's bands, now the doctor's too: RR 32 was not flagged at all there. */
  it("grades the readings the walk-through entered the same on every screen", () => {
    expect(gradeVital(32, ADULT_VITAL_BANDS.respiratory_rate)).toBe("critical_high");
    expect(gradeVital(85, ADULT_VITAL_BANDS.spo2)).toBe("critical_low");
    expect(gradeVital(92, ADULT_VITAL_BANDS.spo2)).toBe("low");
    expect(gradeVital(110, ADULT_VITAL_BANDS.pulse)).toBe("high");
    expect(gradeVital(72, ADULT_VITAL_BANDS.pulse)).toBe("normal");
  });

  /** 226 real registrations have no SpO2. Absent is not hypoxic. */
  it("says nothing when it was never measured", () => {
    expect(gradeVital(null, ADULT_VITAL_BANDS.spo2)).toBe("normal");
  });

  /** Critical in either direction is danger, and every grade has a word. */
  it("pairs each colour with a word", () => {
    expect([gradeTone("critical_low"), gradeLabel("critical_low")]).toEqual([
      "danger",
      "Critical low",
    ]);
    expect([gradeTone("high"), gradeLabel("high")]).toEqual(["warning", "High"]);
    expect(gradeTone("normal")).toBe("primary");
  });
});
