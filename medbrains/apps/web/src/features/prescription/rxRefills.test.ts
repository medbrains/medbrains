import { describe, expect, it } from "vitest";
import { defaultValidUntil, minValidUntil, NO_REFILLS, refillRequest } from "./rxRefills";

const TODAY = "2026-10-10";

describe("refill terms", () => {
  it("a plain prescription is valid for a month", () => {
    expect(refillRequest(NO_REFILLS, TODAY)).toEqual({
      repeats_allowed: 0,
      valid_until: "2026-11-09",
    });
  });

  it("the default expiry stretches to cover every refill", () => {
    const terms = { refills: 3, intervalDays: 30, validUntil: null };
    expect(defaultValidUntil(terms, TODAY)).toBe("2027-01-08");
    expect(minValidUntil(terms, TODAY)).toBe("2027-01-08");
    expect(refillRequest(terms, TODAY)).toEqual({
      repeats_allowed: 3,
      repeat_interval_days: 30,
      valid_until: "2027-01-08",
    });
  });

  it("a date the doctor picks is sent as picked", () => {
    const terms = { refills: 1, intervalDays: 28, validUntil: "2027-03-31" };
    expect(refillRequest(terms, TODAY).valid_until).toBe("2027-03-31");
  });
});
