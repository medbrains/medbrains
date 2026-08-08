import { describe, expect, it } from "vitest";
import { isOverdue, minutesWaiting, OVERDUE_MINUTES, waitingLabel } from "./turnaround.js";

/**
 * A fixed clock, because a test that reads the wall clock passes at 09:00 and
 * fails at midnight.
 */
const NOW = new Date("2026-08-06T12:00:00Z").getTime();
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

describe("minutesWaiting", () => {
  it("counts from dirty_at when the bed was flagged", () => {
    expect(minutesWaiting({ dirty_at: minutesAgo(20), discharge_at: null }, NOW)).toBe(20);
  });

  it("falls back to discharge_at when nobody flagged the bed dirty", () => {
    // The whole reason the fallback exists: a bed nobody flagged is the one
    // that goes unnoticed, and it has usually waited the longest.
    expect(minutesWaiting({ dirty_at: null, discharge_at: minutesAgo(180) }, NOW)).toBe(180);
  });

  it("prefers dirty_at over discharge_at when both exist", () => {
    // The bed became housekeeping's problem when it was flagged, not when the
    // patient left — those can be hours apart while the room is still occupied.
    const row = { dirty_at: minutesAgo(10), discharge_at: minutesAgo(300) };
    expect(minutesWaiting(row, NOW)).toBe(10);
  });

  it("returns null rather than zero when neither timestamp exists", () => {
    // Zero would read as "just now" — the opposite of what unknown means.
    expect(minutesWaiting({ dirty_at: null, discharge_at: null }, NOW)).toBeNull();
  });

  it("returns null for an unparseable timestamp instead of NaN", () => {
    expect(minutesWaiting({ dirty_at: "not-a-date", discharge_at: null }, NOW)).toBeNull();
  });

  it("never returns a negative wait for a clock-skewed future timestamp", () => {
    const future = new Date(NOW + 60 * 60_000).toISOString();
    expect(minutesWaiting({ dirty_at: future, discharge_at: null }, NOW)).toBe(0);
  });
});

describe("isOverdue", () => {
  it("is true exactly at the threshold, not only past it", () => {
    expect(isOverdue(OVERDUE_MINUTES)).toBe(true);
    expect(isOverdue(OVERDUE_MINUTES - 1)).toBe(false);
  });

  it("does not treat unknown as overdue", () => {
    // An unknown wait must not raise an alarm it cannot justify.
    expect(isOverdue(null)).toBe(false);
  });
});

describe("waitingLabel", () => {
  it("says so plainly when the wait is unknown", () => {
    expect(waitingLabel(null)).toBe("Waiting time unknown");
  });

  it("uses minutes under an hour and hours above it", () => {
    expect(waitingLabel(45)).toBe("WAITING 45 MIN");
    expect(waitingLabel(60)).toBe("WAITING 1H 0M");
    expect(waitingLabel(195)).toBe("WAITING 3H 15M");
  });
});
