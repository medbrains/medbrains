import { describe, expect, it } from "vitest";
import { tdsPeriodOf } from "./billing.form";

describe("tdsPeriodOf", () => {
  it("puts each month in the April financial year's quarter, as the server does", () => {
    expect(tdsPeriodOf("2026-04-01")).toEqual({ financial_year: "2026-27", quarter: "Q1" });
    expect(tdsPeriodOf("2026-09-30")).toEqual({ financial_year: "2026-27", quarter: "Q2" });
    expect(tdsPeriodOf("2026-11-12")).toEqual({ financial_year: "2026-27", quarter: "Q3" });
    expect(tdsPeriodOf("2027-03-31")).toEqual({ financial_year: "2026-27", quarter: "Q4" });
    expect(tdsPeriodOf("2099-04-05")).toEqual({ financial_year: "2099-00", quarter: "Q1" });
  });
});
