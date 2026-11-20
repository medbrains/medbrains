import { describe, expect, it } from "vitest";
import { roleName, screenName, trendOf } from "./labels";

describe("form friction labels", () => {
  it("names a screen from its route template, dropping ids", () => {
    expect(screenName("/api/specialty/ophthalmology/exams")).toBe(
      "Specialty › Ophthalmology › Exams",
    );
    expect(screenName("/api/patients/{id}/vital-signs")).toBe("Patients › Vital signs");
    expect(screenName("/api/{id}")).toBe("/api/{id}");
  });

  it("reads fewer refusals as good news and a first refusal as new", () => {
    expect(trendOf(3, 0)).toEqual({ label: "New", tone: "warning" });
    expect(trendOf(0, 0)).toEqual({ label: "Same", tone: "neutral" });
    expect(trendOf(15, 10)).toEqual({ label: "+50%", tone: "warning" });
    expect(trendOf(3, 4)).toEqual({ label: "−25%", tone: "success" });
    expect(trendOf(4, 4)).toEqual({ label: "Same", tone: "neutral" });
  });

  it("shows a role by its name, never its code", () => {
    expect(roleName("super_admin")).toBe("Super Admin");
    expect(roleName("receptionist")).toBe("Receptionist");
    expect(roleName("ward_clerk")).toBe("Ward clerk");
  });
});
