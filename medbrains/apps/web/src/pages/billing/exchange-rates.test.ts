import { describe, expect, it } from "vitest";
import { exchangeRateSchema } from "./exchange-rates-section";

const valid = { from_currency: "USD", rate: 83.25, effective_date: "2026-10-12", source: "" };

describe("exchangeRateSchema", () => {
  it("takes a positive rate for a foreign currency from a date", () => {
    expect(exchangeRateSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a zero rate, a missing date, and rupees as the foreign currency", () => {
    expect(exchangeRateSchema.safeParse({ ...valid, rate: 0 }).success).toBe(false);
    expect(exchangeRateSchema.safeParse({ ...valid, effective_date: "" }).success).toBe(false);
    expect(exchangeRateSchema.safeParse({ ...valid, from_currency: "INR" }).success).toBe(false);
  });
});
