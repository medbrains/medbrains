// @vitest-environment node

import { describe, expect, it } from "vitest";
import { emergencyTabFromSearch, emergencyVisibleTab } from "./emergency-workspace";

describe("emergency workspace tab routing", () => {
  it("parses known emergency tab query values", () => {
    expect(emergencyTabFromSearch("visits")).toBe("visits");
    expect(emergencyTabFromSearch("triage")).toBe("triage");
    expect(emergencyTabFromSearch("resuscitation")).toBe("resuscitation");
    expect(emergencyTabFromSearch("codes")).toBe("codes");
    expect(emergencyTabFromSearch("mlc")).toBe("mlc");
    expect(emergencyTabFromSearch("mass-casualty")).toBe("mass-casualty");
    expect(emergencyTabFromSearch("unknown")).toBeNull();
  });

  it("falls back when a requested tab is not available for the current role", () => {
    expect(emergencyVisibleTab("mlc", ["visits", "triage"], "visits")).toBe("visits");
    expect(emergencyVisibleTab("mlc", ["visits", "mlc"], "visits")).toBe("mlc");
    expect(emergencyVisibleTab(null, ["visits", "mlc"], "visits")).toBe("visits");
  });
});
