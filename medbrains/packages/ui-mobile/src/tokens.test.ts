import { describe, expect, it } from "vitest";
import {
  APP_BAR,
  COLORS,
  INTENT_BG,
  INTENT_FG,
  type IntentTone,
  RADIUS,
  SPACING,
} from "./tokens.js";

describe("tokens", () => {
  it("color tokens match the locked web enterprise palette", () => {
    expect(COLORS.brand).toBe("#0066CC");
    expect(COLORS.copper).toBe("#B7322E");
    expect(COLORS.accent).toBe(COLORS.copper);
    expect(COLORS.vital).toBe("#34D69D");
    expect(COLORS.emerald).toBe("#1CB785");
    expect(COLORS.amber).toBe("#FF9F0A");
    expect(COLORS.navActiveBg).toBe("#EEF4FC");
    expect(COLORS.accentGradientEnd).toBe("#B7322E");
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
