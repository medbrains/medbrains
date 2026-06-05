// @vitest-environment node

import { describe, expect, it } from "vitest";
import { campWorkDefaultTab, campWorkTabFromString } from "./camp-workspace";

describe("camp workspace tab routing", () => {
  it("normalizes valid work tab values and rejects unknown hashes", () => {
    expect(campWorkTabFromString("registrations")).toBe("registrations");
    expect(campWorkTabFromString("screenings")).toBe("screenings");
    expect(campWorkTabFromString("followups")).toBe("followups");
    expect(campWorkTabFromString("analytics")).toBe("analytics");
    expect(campWorkTabFromString("unknown")).toBeNull();
  });

  it("defaults registration clinical routes to screening", () => {
    expect(campWorkDefaultTab("registrations", "registration-1")).toBe("screenings");
    expect(campWorkDefaultTab("analytics")).toBe("analytics");
    expect(campWorkDefaultTab("unknown")).toBe("registrations");
  });
});
