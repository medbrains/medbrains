import { describe, expect, it } from "vitest";
import { doseSchema } from "./immunization.form";

const dose = {
  vaccine_name: "Hepatitis B vaccine",
  administered_on: new Date("2026-10-01"),
  given_elsewhere: false,
};

describe("doseSchema", () => {
  it("needs the lot for a dose given here (batch traceability), not for one off the card", () => {
    expect(doseSchema.safeParse(dose).success).toBe(false);
    expect(doseSchema.safeParse({ ...dose, lot_number: "HB-2231" }).success).toBe(true);
    expect(doseSchema.safeParse({ ...dose, given_elsewhere: true }).success).toBe(true);
  });

  it("refuses a date still to come", () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const r = doseSchema.safeParse({ ...dose, lot_number: "X", administered_on: tomorrow });
    expect(r.success).toBe(false);
  });
});
