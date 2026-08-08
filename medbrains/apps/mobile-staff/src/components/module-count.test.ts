import { describe, expect, it } from "vitest";
import { COUNT_UNKNOWN, resolveCount } from "./module-count.js";

interface Incident {
  status: string;
}

const OPEN: Incident[] = [
  { status: "reported" },
  { status: "investigating" },
  { status: "resolved" },
];

describe("resolveCount", () => {
  it("counts everything when no filter is given", () => {
    expect(resolveCount(OPEN, null)).toBe(3);
  });

  it("counts only what matches when a filter is given", () => {
    expect(resolveCount(OPEN, null, (i) => i.status !== "resolved")).toBe(2);
  });

  it("is unknown — not zero — when the fetch failed", () => {
    // The rule this whole module exists for. A tile reading "0 active
    // incidents" because the network was down is indistinguishable from a quiet
    // shift, and it stops someone acting on a queue that is actually full.
    expect(resolveCount<Incident>(null, "Network request failed")).toBe(COUNT_UNKNOWN);
  });

  it("is unknown while there is no data yet", () => {
    expect(resolveCount<Incident>(null, null)).toBe(COUNT_UNKNOWN);
  });

  it("stays unknown on error even when stale data is present", () => {
    // A number that is known to be out of date must not be presented as current
    // on a screen someone uses to decide where to go next.
    expect(resolveCount(OPEN, "Network request failed")).toBe(COUNT_UNKNOWN);
  });

  it("reports a real zero when the fetch succeeded and nothing matched", () => {
    // The other half of the rule: an honest zero must still be shown as zero,
    // or a genuinely clear worklist would look like a broken screen.
    expect(resolveCount(OPEN, null, (i) => i.status === "escalated")).toBe(0);
    expect(resolveCount([], null)).toBe(0);
  });
});
