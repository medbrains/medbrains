// @vitest-environment node

import { BLOOD_GROUP_OPTIONS, bloodGroupLabel } from "@medbrains/types";
import { describe, expect, it } from "vitest";

describe("blood group options", () => {
  it("send the enum value the database accepts, never the label", () => {
    const values = BLOOD_GROUP_OPTIONS.map((o) => o.value);
    expect(values).toHaveLength(8);
    for (const v of values) expect(v).toMatch(/^(a|b|ab|o)_(positive|negative)$/);
    expect(values).not.toContain("A+");
  });

  it("label enum values the way a bag prints them", () => {
    expect(bloodGroupLabel("o_negative")).toBe("O-");
    expect(bloodGroupLabel("ab_positive")).toBe("AB+");
    expect(bloodGroupLabel("unknown")).toBe("Unknown");
    expect(bloodGroupLabel(null)).toBe("—");
    expect(bloodGroupLabel("A+")).toBe("A+");
  });
});
