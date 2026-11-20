import { describe, expect, it } from "vitest";
import { meetsTarget } from "./indicator-direction";

describe("meetsTarget", () => {
  it("does not call a fall rate above its target met", () => {
    expect(meetsTarget("lower_better", 3.5, 2)).toBe(false);
    expect(meetsTarget("lower_better", 1.5, 2)).toBe(true);
  });

  it("meets a higher-is-better target at or above it", () => {
    expect(meetsTarget("higher_better", 90, 90)).toBe(true);
    expect(meetsTarget("higher_better", 80, 90)).toBe(false);
  });

  it("says nothing when the value, the target or the direction is missing", () => {
    expect(meetsTarget(null, 3.5, 2)).toBeNull();
    expect(meetsTarget("lower_better", undefined, 2)).toBeNull();
    expect(meetsTarget("lower_better", 0, null)).toBeNull();
  });
});
