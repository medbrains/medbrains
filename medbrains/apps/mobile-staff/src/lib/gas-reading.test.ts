import { describe, expect, it } from "vitest";
import { checkGasReading, type GasReadingDraft } from "./gas-reading.js";

const empty: GasReadingDraft = {
  purity_percent: "",
  pressure_bar: "",
  tank_level_percent: "",
  is_alarm: false,
  alarm_reason: "",
};

describe("checkGasReading", () => {
  it("will not submit an entirely empty reading", () => {
    // A row recording nothing is worse than no row — it looks like the round
    // was walked when it was not.
    expect(checkGasReading(empty).canSubmit).toBe(false);
  });

  it("accepts a single measurement", () => {
    expect(checkGasReading({ ...empty, purity_percent: "99.5" }).canSubmit).toBe(true);
  });

  it("rejects a percentage above 100", () => {
    // A slipped decimal must not reach a PESO log.
    const result = checkGasReading({ ...empty, purity_percent: "995" });
    expect(result.purity).toContain("between 0 and 100");
    expect(result.canSubmit).toBe(false);
  });

  it("rejects a negative measurement", () => {
    expect(checkGasReading({ ...empty, pressure_bar: "-1" }).pressure).toBeDefined();
  });

  it("rejects text where a number belongs", () => {
    expect(checkGasReading({ ...empty, tank_level_percent: "half" }).tankLevel).toBeDefined();
  });

  it("refuses an alarm with no reason", () => {
    // The gap the web form leaves open: a flagged reading nobody explained.
    const result = checkGasReading({ ...empty, pressure_bar: "4.1", is_alarm: true });
    expect(result.alarmReason).toBeDefined();
    expect(result.canSubmit).toBe(false);
  });

  it("accepts an alarm that says what it is", () => {
    const result = checkGasReading({
      ...empty,
      pressure_bar: "2.1",
      is_alarm: true,
      alarm_reason: "Manifold pressure dropping, changed over to reserve bank",
    });
    expect(result.canSubmit).toBe(true);
  });

  it("allows an alarm with no measurement at all", () => {
    // An audible alarm with nothing readable on the gauge is still worth
    // logging, and is exactly when someone is least likely to type numbers.
    const result = checkGasReading({
      ...empty,
      is_alarm: true,
      alarm_reason: "Low pressure alarm sounding, gauge unreadable",
    });
    expect(result.canSubmit).toBe(true);
  });

  it("states no opinion on whether a value is clinically safe", () => {
    // Deliberate: safe ranges are the site's PESO engineering decision, not a
    // constant invented in this file.
    expect(checkGasReading({ ...empty, purity_percent: "12" }).purity).toBeUndefined();
  });
});
