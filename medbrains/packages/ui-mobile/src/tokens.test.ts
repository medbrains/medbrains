import { amber, blue, cinnabar, mint } from "@medbrains/design-system/tokens";
import { describe, expect, it } from "vitest";
import {
  APP_BAR,
  COLORS,
  INTENT_BG,
  INTENT_FG,
  type IntentTone,
  OVERSCAN,
  RADIUS,
  SPACING,
} from "./tokens.js";

describe("tokens", () => {
  it("colors are wired to the Carbon design-system ramps", () => {
    // Assert the wiring (correct ramp index), not brittle literals — so the test
    // tracks the single Carbon token source and can't go stale on a palette shift.
    expect(COLORS.brand).toBe(blue[5]);
    expect(COLORS.copper).toBe(cinnabar[5]);
    expect(COLORS.accent).toBe(COLORS.copper);
    expect(COLORS.vital).toBe(mint[3]);
    expect(COLORS.emerald).toBe(mint[4]);
    expect(COLORS.amber).toBe(amber[5]);
    expect(COLORS.navActiveBg).toBe(blue[0]);
    expect(COLORS.accentGradientEnd).toBe(blue[8]);
    expect(APP_BAR.background).toBe(COLORS.navActiveBg);
    expect(APP_BAR.title).toBe(COLORS.brandDeep);
  });

  it("every intent has both bg and fg", () => {
    const tones: IntentTone[] = ["neutral", "info", "success", "warn", "alert", "copper"];
    for (const tone of tones) {
      expect(INTENT_BG[tone]).toMatch(/^#|^rgba/);
      expect(INTENT_FG[tone]).toMatch(/^#|^rgba/);
    }
  });

  it("spacing is monotonic", () => {
    expect(SPACING.xs).toBeLessThan(SPACING.sm);
    expect(SPACING.sm).toBeLessThan(SPACING.md);
    expect(SPACING.md).toBeLessThan(SPACING.lg);
    expect(SPACING.lg).toBeLessThan(SPACING.xl);
  });

  it("radius follows Carbon sharp-corner intent (small, non-decreasing)", () => {
    // Carbon = sharp corners; sm and md are intentionally equal (2px hairline).
    expect(RADIUS.sm).toBeLessThanOrEqual(RADIUS.md);
    expect(RADIUS.md).toBeLessThanOrEqual(RADIUS.lg);
    expect(RADIUS.lg).toBeLessThanOrEqual(4);
  });

  it("overscan is the TV 10-foot safe area (48dp L/R, 27dp T/B)", () => {
    expect(OVERSCAN.horizontal).toBe(48);
    expect(OVERSCAN.vertical).toBe(27);
  });
});
