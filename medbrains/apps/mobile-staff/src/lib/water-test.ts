/**
 * Whether a water result sits inside its own stated limits.
 *
 * The contrast with medical gas (`lib/gas-reading`) is deliberate. There, no
 * safe range exists in the data, so inventing one would have been guesswork.
 * Here `acceptable_min` and `acceptable_max` are recorded **with each test**,
 * so compliance is arithmetic against the site's own stated limits and can be
 * derived honestly.
 *
 * That matters most for dialysis water, where a chemical or endotoxin
 * exceedance reaches a patient's bloodstream directly.
 */

export interface WaterLimits {
  result_value: number | null;
  acceptable_min: number | null;
  acceptable_max: number | null;
}

export type WaterVerdict = "within" | "outside" | "no_limits" | "no_result";

export function waterVerdict(test: WaterLimits): WaterVerdict {
  if (test.result_value === null || !Number.isFinite(test.result_value)) {
    return "no_result";
  }
  const hasMin = test.acceptable_min !== null && Number.isFinite(test.acceptable_min);
  const hasMax = test.acceptable_max !== null && Number.isFinite(test.acceptable_max);
  if (!hasMin && !hasMax) {
    // A number with nothing to compare it against proves nothing. Reporting it
    // as compliant would be the same error as calling undated equipment "ok".
    return "no_limits";
  }
  if (hasMin && (test.result_value as number) < (test.acceptable_min as number)) {
    return "outside";
  }
  if (hasMax && (test.result_value as number) > (test.acceptable_max as number)) {
    return "outside";
  }
  return "within";
}

export interface WaterTestDraft {
  parameter_name: string;
  result_value: string;
  acceptable_min: string;
  acceptable_max: string;
  corrective_action: string;
}

export interface WaterTestProblems {
  parameter?: string;
  result?: string;
  limits?: string;
  correctiveAction?: string;
  verdict: WaterVerdict;
  canSubmit: boolean;
}

function parse(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function checkWaterTest(draft: WaterTestDraft): WaterTestProblems {
  const result = parse(draft.result_value);
  const min = parse(draft.acceptable_min);
  const max = parse(draft.acceptable_max);

  const parameter =
    draft.parameter_name.trim().length < 2 ? "Name the parameter tested." : undefined;
  const resultProblem = Number.isNaN(result) ? "Result must be a number." : undefined;

  // A range that excludes everything is a typo, and it would mark every future
  // result non-compliant.
  const limits =
    Number.isNaN(min) || Number.isNaN(max)
      ? "Limits must be numbers."
      : min !== null && max !== null && min > max
        ? "The lower limit is above the upper limit."
        : undefined;

  const verdict =
    resultProblem || limits
      ? "no_result"
      : waterVerdict({
          result_value: result,
          acceptable_min: min,
          acceptable_max: max,
        });

  // A failing result with no corrective action is a finding nobody owns.
  const correctiveAction =
    verdict === "outside" && draft.corrective_action.trim().length < 5
      ? "Say what was done about it. A result outside limits cannot be filed without an action."
      : undefined;

  return {
    parameter,
    result: resultProblem,
    limits,
    correctiveAction,
    verdict,
    canSubmit: !parameter && !resultProblem && !limits && !correctiveAction && result !== null,
  };
}
