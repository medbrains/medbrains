import { describe, expect, it } from "vitest";
import { blocksRelease, bySeverity, describeViolations, type QcStatus } from "./lab-qc.js";

const run = (
  status: QcStatus,
  run_date: string | null = "2026-08-08",
  violations: string[] | null = null,
) => ({
  status,
  run_date,
  westgard_violations: violations,
});

describe("bySeverity", () => {
  it("puts rejected first, then warning, then accepted", () => {
    const ordered = bySeverity([run("accepted"), run("warning"), run("rejected")]);
    expect(ordered.map((r) => r.status)).toEqual(["rejected", "warning", "accepted"]);
  });

  it("shows the most recent first within a status", () => {
    const ordered = bySeverity([run("rejected", "2026-08-01"), run("rejected", "2026-08-08")]);
    expect(ordered.map((r) => r.run_date)).toEqual(["2026-08-08", "2026-08-01"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [run("accepted"), run("rejected")];
    bySeverity(input);
    expect(input.map((r) => r.status)).toEqual(["accepted", "rejected"]);
  });
});

describe("blocksRelease", () => {
  it("blocks on a rejected run", () => {
    expect(blocksRelease(run("rejected"))).toBe(true);
  });

  it("also blocks on a warning", () => {
    // A warning rule like 1_2s exists to make someone look before releasing.
    // Treating it as a pass is how the Westgard scheme stops working.
    expect(blocksRelease(run("warning"))).toBe(true);
  });

  it("clears only on accepted", () => {
    expect(blocksRelease(run("accepted"))).toBe(false);
  });
});

describe("describeViolations", () => {
  it("names the rules in plain language", () => {
    // "r_4s" means nothing to someone reading this at 2am.
    expect(describeViolations(["1_3s", "r_4s"])).toBe("one result beyond 3SD, range across 4SD");
  });

  it("says so when there are none", () => {
    expect(describeViolations(null)).toBe("No rule violations");
    expect(describeViolations([])).toBe("No rule violations");
  });

  it("passes through a rule it does not recognise rather than hiding it", () => {
    // An unknown rule is still a violation; dropping it would under-report.
    expect(describeViolations(["9_9s"])).toBe("9_9s");
  });
});
