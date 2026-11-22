import type { ErVisit, ErWaitTargets } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { formatWait, waitTarget } from "./wait-time";

const targets: ErWaitTargets = {
  immediate: 0,
  emergent: 10,
  urgent: 60,
  less_urgent: 120,
  non_urgent: 240,
};
const visit = (triage_level: ErVisit["triage_level"]) => ({ triage_level }) as ErVisit;

describe("the ER list's wait target", () => {
  it("is the target of the visit's triage level", () => {
    expect(waitTarget(visit("emergent"), targets)).toBe(10);
    expect(waitTarget(visit("immediate"), targets)).toBe(0);
  });

  it("is absent for a patient not triaged, and while the targets have not loaded", () => {
    expect(waitTarget(visit(null), targets)).toBeUndefined();
    expect(waitTarget(visit("expectant"), targets)).toBeUndefined();
    expect(waitTarget(visit("urgent"), undefined)).toBeUndefined();
  });

  it("reads a wait in minutes, then hours and minutes", () => {
    expect(formatWait(45)).toBe("45 min");
    expect(formatWait(65)).toBe("1 h 05 min");
  });
});
