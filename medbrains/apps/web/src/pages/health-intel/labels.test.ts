import type { CheckStatus } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { airLabel, checkLabel, formatCount, heatLabel, levelLabel, troubledChecks } from "./labels";

describe("health intelligence labels", () => {
  it("never prints a count of 1 to 4", () => {
    expect(formatCount(null)).toBe("fewer than 5");
    for (const n of [1, 2, 3, 4]) expect(formatCount(n)).toBe("fewer than 5");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(5)).toBe("5");
    expect(formatCount(14)).toBe("14");
  });

  it("says each level in words, not colour alone", () => {
    expect(levelLabel("usual").label).toBe("Usual");
    expect(levelLabel("higher")).toEqual({ label: "Higher than usual", tone: "warning" });
    expect(levelLabel("much_higher")).toEqual({ label: "Much higher than usual", tone: "danger" });
  });

  it("names heat and air bands and never guesses an unknown one", () => {
    expect(heatLabel("heat_wave").label).toBe("Heat wave");
    expect(airLabel("very_poor").label).toBe("Very poor");
    expect(airLabel("made_up").label).toBe("Unknown");
  });

  it("treats a stopped or never-run check as trouble, not as quiet", () => {
    const check = (state: CheckStatus["state"]): CheckStatus => ({
      name: state,
      kind: "feed",
      label: state,
      state,
      last_ok_at: null,
      last_attempt_at: null,
      last_error: null,
    });
    const all = [check("running"), check("stopped"), check("never_run"), check("failing")];
    expect(troubledChecks(all).map((c) => c.state)).toEqual(["stopped", "never_run", "failing"]);
    expect(checkLabel("stopped").label).toBe("Stopped");
  });
});
