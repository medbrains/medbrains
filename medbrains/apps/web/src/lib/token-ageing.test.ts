import { describe, expect, it } from "vitest";
import { effectiveWeight, formatWaited, hasAged, minutesWaited } from "./token-ageing";

const NOW = new Date("2026-09-03T12:00:00Z");
const ago = (mins: number) => new Date(NOW.getTime() - mins * 60_000).toISOString();

describe("token ageing, as the desk sees it", () => {
  it("matches the server's curve step for step", () => {
    // Migration 1006: one step per 30 minutes. If these drift apart the desk
    // explains an order the server did not choose.
    expect(effectiveWeight("normal", ago(0), NOW)).toBe(6);
    expect(effectiveWeight("normal", ago(30), NOW)).toBe(5);
    expect(effectiveWeight("normal", ago(60), NOW)).toBe(4);
    expect(effectiveWeight("normal", ago(90), NOW)).toBe(3);
  });

  it("never lets waiting pass a clinical emergency", () => {
    // The line that matters. A day of waiting must not precede a fresh
    // urgent case — this is a fairness fix, not a triage change.
    expect(effectiveWeight("normal", ago(1440), NOW)).toBe(3);
    expect(effectiveWeight("urgent", ago(1440), NOW)).toBe(1);
    expect(effectiveWeight("stat", ago(1440), NOW)).toBe(0);
    expect(effectiveWeight("normal", ago(1440), NOW)).toBeGreaterThan(
      effectiveWeight("urgent", ago(0), NOW),
    );
  });

  it("says a token has aged only once it actually moved", () => {
    expect(hasAged("normal", ago(29), NOW)).toBe(false);
    expect(hasAged("normal", ago(30), NOW)).toBe(true);
    // A clinical priority cannot age, so it never claims to have.
    expect(hasAged("stat", ago(600), NOW)).toBe(false);
    expect(hasAged("urgent", ago(600), NOW)).toBe(false);
  });

  it("reads a wait the way a person says it", () => {
    expect(formatWaited(ago(45), NOW)).toBe("45m");
    expect(formatWaited(ago(120), NOW)).toBe("2h");
    expect(formatWaited(ago(135), NOW)).toBe("2h 15m");
  });

  it("treats an unparseable timestamp as no wait rather than a huge one", () => {
    // A bad date must not silently promote someone to the front.
    expect(minutesWaited("not a date", NOW)).toBe(0);
    expect(hasAged("normal", "not a date", NOW)).toBe(false);
  });
});
