import { describe, expect, it } from "vitest";
import { ewsDueState, ewsReferenceLines, ewsTotalText } from "./ews-display";

describe("ews display", () => {
  it("marks an incomplete total as a floor, never a normal score", () => {
    expect(ewsTotalText(3, true)).toBe("3+");
    expect(ewsTotalText(0, false)).toBe("0");
  });

  it("draws each tool's urgent and emergency thresholds", () => {
    expect(ewsReferenceLines("news2").map((l) => l.y)).toEqual([5, 7]);
    expect(ewsReferenceLines("pews").map((l) => l.y)).toEqual([6, 8]);
  });

  it("is overdue the moment the due time passes", () => {
    const now = Date.parse("2026-10-26T10:00:00Z");
    expect(ewsDueState("2026-10-26T10:00:00Z", now)).toBe("overdue");
    expect(ewsDueState("2026-10-26T10:10:00Z", now)).toBe("due_soon");
    expect(ewsDueState("2026-10-26T11:00:00Z", now)).toBe("scheduled");
  });
});
