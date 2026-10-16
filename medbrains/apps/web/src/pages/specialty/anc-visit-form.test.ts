import { describe, expect, it } from "vitest";
import {
  ancVisitSchema,
  hasProteinuria,
  isPreEclampsiaRangeBp,
  toCreateAncVisitRequest,
} from "./anc-visit-form";

describe("pre-eclampsia screen", () => {
  it("flags 140/90 and above on either number, inclusive", () => {
    expect(isPreEclampsiaRangeBp(140, 80)).toBe(true);
    expect(isPreEclampsiaRangeBp(130, 90)).toBe(true);
    expect(isPreEclampsiaRangeBp(139, 89)).toBe(false);
    expect(isPreEclampsiaRangeBp(undefined, undefined)).toBe(false);
  });

  it("counts proteinuria from 1+ on dipstick, not trace", () => {
    expect(hasProteinuria("1+")).toBe(true);
    expect(hasProteinuria("trace")).toBe(false);
    expect(hasProteinuria("nil")).toBe(false);
  });
});

describe("ancVisitSchema", () => {
  it("needs the gestational age", () => {
    const result = ancVisitSchema.safeParse({ visit_number: 1 });
    expect(result.error?.issues[0]?.path).toEqual(["gestational_weeks"]);
  });

  it("refuses a half-entered or swapped BP and an impossible FHR", () => {
    const base = { visit_number: 2, gestational_weeks: 28 };
    expect(ancVisitSchema.safeParse({ ...base, bp_systolic: 150 }).success).toBe(false);
    expect(ancVisitSchema.safeParse({ ...base, bp_systolic: 70, bp_diastolic: 100 }).success).toBe(
      false,
    );
    expect(ancVisitSchema.safeParse({ ...base, fetal_heart_rate: 300 }).success).toBe(false);
  });

  it("sends both BP numbers and the dipstick/oedema answers as entered", () => {
    const values = ancVisitSchema.parse({
      visit_number: 3,
      gestational_weeks: 32,
      bp_systolic: 146,
      bp_diastolic: 94,
      urine_protein: "2+",
      oedema: "pedal",
      notes: " ",
    });
    expect(toCreateAncVisitRequest(values)).toEqual({
      visit_number: 3,
      gestational_weeks: 32,
      bp_systolic: 146,
      bp_diastolic: 94,
      urine_protein: "2+",
      oedema: "pedal",
      notes: undefined,
    });
  });
});
