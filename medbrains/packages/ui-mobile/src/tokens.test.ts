import { describe, expect, it } from "vitest";
import {
  COLORS,
  INTENT_BG,
  INTENT_FG,
  RADIUS,
  SPACING,
  type IntentTone,
} from "./tokens.js";

describe("tokens", () => {
  it("color tokens match the locked Forest+Copper hexes", () => {
    expect(COLORS.brand).toBe("#1F4332");
    expect(COLORS.copper).toBe("#B8924A");
    expect(COLORS.emerald).toBe("#34d399");
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
