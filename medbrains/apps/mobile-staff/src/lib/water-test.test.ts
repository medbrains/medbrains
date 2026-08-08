import { describe, expect, it } from "vitest";
import { checkWaterTest, type WaterTestDraft, waterVerdict } from "./water-test.js";

const draft = (over: Partial<WaterTestDraft> = {}): WaterTestDraft => ({
  parameter_name: "Endotoxin",
  result_value: "0.1",
  acceptable_min: "",
  acceptable_max: "0.25",
  corrective_action: "",
  ...over,
});

describe("waterVerdict", () => {
  it("is within when the result sits inside both limits", () => {
    expect(waterVerdict({ result_value: 7, acceptable_min: 6.5, acceptable_max: 8.5 })).toBe(
      "within",
    );
  });

  it("is outside below the minimum", () => {
    expect(waterVerdict({ result_value: 5, acceptable_min: 6.5, acceptable_max: 8.5 })).toBe(
      "outside",
    );
  });

  it("is outside above the maximum", () => {
    expect(waterVerdict({ result_value: 0.4, acceptable_min: null, acceptable_max: 0.25 })).toBe(
      "outside",
    );
  });

  it("treats a value exactly on a limit as within", () => {
    // The limit is the acceptable bound, not the first failing value.
    expect(waterVerdict({ result_value: 0.25, acceptable_min: null, acceptable_max: 0.25 })).toBe(
      "within",
    );
  });

  it("is no_limits, not within, when nothing bounds the result", () => {
    // A number with nothing to compare against proves nothing. Calling it
    // compliant is the same error as calling undated equipment "ok".
    expect(waterVerdict({ result_value: 9000, acceptable_min: null, acceptable_max: null })).toBe(
      "no_limits",
    );
  });

  it("is no_result when nothing was measured", () => {
    expect(waterVerdict({ result_value: null, acceptable_min: 1, acceptable_max: 2 })).toBe(
      "no_result",
    );
  });
});

describe("checkWaterTest", () => {
  it("accepts a compliant result with no corrective action", () => {
    const problems = checkWaterTest(draft());
    expect(problems.verdict).toBe("within");
    expect(problems.canSubmit).toBe(true);
  });

  it("refuses a failing result with no corrective action", () => {
    // A finding nobody owns.
    const problems = checkWaterTest(draft({ result_value: "0.9" }));
    expect(problems.verdict).toBe("outside");
    expect(problems.correctiveAction).toBeDefined();
    expect(problems.canSubmit).toBe(false);
  });

  it("accepts a failing result that records what was done", () => {
    const problems = checkWaterTest(
      draft({ result_value: "0.9", corrective_action: "Loop sanitised, resampled" }),
    );
    expect(problems.canSubmit).toBe(true);
  });

  it("rejects an inverted range", () => {
    // A typo that would mark every future result non-compliant.
    const problems = checkWaterTest(draft({ acceptable_min: "9", acceptable_max: "1" }));
    expect(problems.limits).toContain("above the upper limit");
    expect(problems.canSubmit).toBe(false);
  });

  it("rejects a non-numeric result", () => {
    expect(checkWaterTest(draft({ result_value: "trace" })).result).toBeDefined();
  });

  it("requires the parameter to be named", () => {
    expect(checkWaterTest(draft({ parameter_name: "" })).parameter).toBeDefined();
  });
});
