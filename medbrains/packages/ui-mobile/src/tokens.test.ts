import { describe, expect, it } from "vitest";
import {
  APP_BAR,
  COLORS,
  INTENT_BG,
  INTENT_FG,
  RADIUS,
  SPACING,
  type IntentTone,
} from "./tokens.js";

describe("tokens", () => {
  it("color tokens match the locked web clinical teal and copper hexes", () => {
    expect(COLORS.brand).toBe("#0F766E");
    expect(COLORS.copper).toBe("#B8924A");
    expect(COLORS.emerald).toBe("#10b981");
    expect(COLORS.navActiveBg).toBe("#ccfbf1");
    expect(COLORS.accentGradientEnd).toBe("#f59e0b");
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

  it("radius is monotonic", () => {
    expect(RADIUS.sm).toBeLessThan(RADIUS.md);
    expect(RADIUS.md).toBeLessThan(RADIUS.lg);
  });
});
