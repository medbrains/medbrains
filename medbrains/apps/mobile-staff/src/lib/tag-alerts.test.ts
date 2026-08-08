import { describe, expect, it } from "vitest";
import {
  byMostUrgent,
  ESCALATE_MINUTES,
  minutesSinceTrigger,
  needsEscalation,
} from "./tag-alerts.js";

const NOW = new Date("2026-08-08T12:00:00Z").getTime();
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

describe("minutesSinceTrigger", () => {
  it("measures from the trigger", () => {
    expect(minutesSinceTrigger({ id: "a", triggered_at: minutesAgo(7) }, NOW)).toBe(7);
  });

  it("returns null rather than NaN for an unreadable timestamp", () => {
    expect(minutesSinceTrigger({ id: "a", triggered_at: "nonsense" }, NOW)).toBeNull();
  });

  it("clamps a future timestamp to zero rather than going negative", () => {
    const ahead = new Date(NOW + 120_000).toISOString();
    expect(minutesSinceTrigger({ id: "a", triggered_at: ahead }, NOW)).toBe(0);
  });
});

describe("needsEscalation", () => {
  it("escalates at the threshold, not only past it", () => {
    expect(needsEscalation(ESCALATE_MINUTES)).toBe(true);
    expect(needsEscalation(ESCALATE_MINUTES - 1)).toBe(false);
  });

  it("does not escalate an unknown age", () => {
    expect(needsEscalation(null)).toBe(false);
  });
});

describe("byMostUrgent", () => {
  it("puts the longest-unanswered alert first", () => {
    // The inverse of every other list here. The oldest alert is the one where a
    // tagged patient has had the most time to leave the building.
    const ordered = byMostUrgent([
      { id: "recent", triggered_at: minutesAgo(1) },
      { id: "oldest", triggered_at: minutesAgo(30) },
      { id: "middle", triggered_at: minutesAgo(10) },
    ]);
    expect(ordered.map((a) => a.id)).toEqual(["oldest", "middle", "recent"]);
  });

  it("sorts an unreadable timestamp to the top, not the bottom", () => {
    // It cannot be shown to be safe, so it must not be buried.
    const ordered = byMostUrgent([
      { id: "ok", triggered_at: minutesAgo(2) },
      { id: "broken", triggered_at: "" },
    ]);
    expect(ordered[0]?.id).toBe("broken");
  });

  it("does not mutate the caller's array", () => {
    const input = [
      { id: "a", triggered_at: minutesAgo(1) },
      { id: "b", triggered_at: minutesAgo(9) },
    ];
    byMostUrgent(input);
    expect(input.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
