import { describe, expect, it } from "vitest";
import { nextSafetyState, type SafetyView } from "./safetyState";

interface Alerts {
  interactions: string[];
}

const EMPTY: Alerts = { interactions: [] };
const PENICILLIN: Alerts = { interactions: ["amoxicillin × warfarin (major)"] };

describe("nextSafetyState", () => {
  it("shows what the service returned", () => {
    expect(nextSafetyState({ type: "checked", alerts: PENICILLIN }, EMPTY)).toEqual({
      alerts: PENICILLIN,
      unavailable: false,
    });
  });

  it("clears when there is nothing to check", () => {
    expect(nextSafetyState({ type: "reset" }, EMPTY)).toEqual({
      alerts: EMPTY,
      unavailable: false,
    });
  });

  /**
   * The regression this module exists for. A writer that keeps the previous
   * state on failure shows one drug list's verdict against another.
   */
  it("does not carry a previous verdict through a failure", () => {
    const shown: SafetyView<Alerts> = nextSafetyState(
      { type: "checked", alerts: PENICILLIN },
      EMPTY,
    );
    expect(shown.alerts).toBe(PENICILLIN);

    const afterFailure = nextSafetyState<Alerts>({ type: "failed" }, EMPTY);
    expect(afterFailure.alerts).not.toBe(PENICILLIN);
    expect(afterFailure.alerts).toEqual(EMPTY);
    // Dropping the alerts is not enough on its own — a writer that showed an
    // empty list without saying why would still be claiming a screening it
    // never got.
    expect(afterFailure.unavailable).toBe(true);
    expect(afterFailure).not.toEqual(shown);
  });

  it("marks a failure as unavailable rather than clear", () => {
    const afterFailure = nextSafetyState<Alerts>({ type: "failed" }, EMPTY);
    expect(afterFailure.unavailable).toBe(true);
  });

  /**
   * Empty alerts alone cannot distinguish "screened, nothing found" from
   * "never screened" — the flag is what separates them, so the two states
   * must not compare equal.
   */
  it("distinguishes a clean screening from an absent one", () => {
    const clean = nextSafetyState({ type: "checked", alerts: EMPTY }, EMPTY);
    const absent = nextSafetyState<Alerts>({ type: "failed" }, EMPTY);

    expect(clean.alerts).toEqual(absent.alerts);
    expect(clean).not.toEqual(absent);
    expect(clean.unavailable).toBe(false);
    expect(absent.unavailable).toBe(true);
  });
});
