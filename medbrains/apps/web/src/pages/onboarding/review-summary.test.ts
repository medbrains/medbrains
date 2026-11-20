import { describe, expect, it } from "vitest";
import { localeSummary, setupWarnings } from "./review-summary";

describe("review summary", () => {
  it("names the country's defaults when the zone and currency are left empty", () => {
    expect(localeSummary({ timezone: null, currency: "AED" })).toBe("Country's time zone · AED");
  });

  it("warns only about the parts still empty", () => {
    const warnings = setupWarnings({
      facilities: [],
      departments: [1],
      users: [1],
      enabledModules: [1],
      bedTypes: [],
      taxCategories: [1],
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/facilities/);
    expect(warnings[1]).toMatch(/bed types/);
  });
});
