import { describe, expect, it } from "vitest";
import { type CheckResult, nextCheckState } from "./advisoryCheck";

interface Findings {
  items: string[];
}

const EMPTY: Findings = { items: [] };
const FOUND: Findings = { items: ["amoxicillin × warfarin (major)"] };

describe("nextCheckState", () => {
  it("shows what the service returned", () => {
    expect(nextCheckState({ type: "checked", findings: FOUND }, EMPTY)).toEqual({
      findings: FOUND,
      unavailable: false,
    });
  });

  it("clears when there is nothing to check", () => {
    expect(nextCheckState({ type: "reset" }, EMPTY)).toEqual({
      findings: EMPTY,
      unavailable: false,
    });
  });

  /**
   * The regression this module exists for. A screen that keeps the previous
   * state on failure shows one subject's result against another.
   */
  it("does not carry a previous result through a failure", () => {
    const shown: CheckResult<Findings> = nextCheckState(
      { type: "checked", findings: FOUND },
      EMPTY,
    );
    expect(shown.findings).toBe(FOUND);

    const afterFailure = nextCheckState<Findings>({ type: "failed" }, EMPTY);
    expect(afterFailure.findings).not.toBe(FOUND);
    expect(afterFailure.findings).toEqual(EMPTY);
    // Dropping the findings is not enough on its own — a screen that showed an
    // empty result without saying why would still be claiming a check it never
    // got.
    expect(afterFailure.unavailable).toBe(true);
    expect(afterFailure).not.toEqual(shown);
  });

  it("marks a failure as unavailable rather than clear", () => {
    expect(nextCheckState<Findings>({ type: "failed" }, EMPTY).unavailable).toBe(true);
  });

  /**
   * Empty findings alone cannot distinguish "checked, nothing found" from
   * "never checked" — the flag is what separates them, so the two states must
   * not compare equal.
   */
  it("distinguishes a clean check from an absent one", () => {
    const clean = nextCheckState({ type: "checked", findings: EMPTY }, EMPTY);
    const absent = nextCheckState<Findings>({ type: "failed" }, EMPTY);

    expect(clean.findings).toEqual(absent.findings);
    expect(clean).not.toEqual(absent);
    expect(clean.unavailable).toBe(false);
    expect(absent.unavailable).toBe(true);
  });
});
