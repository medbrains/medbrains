import { describe, expect, it } from "vitest";
import { buildForestCopperTheme, EMERGENCY_CODES, FOREST_COPPER_PALETTE } from "./forest-copper.js";

describe("buildForestCopperTheme", () => {
  it("palette mirrors the locked web enterprise anchors", () => {
    expect(FOREST_COPPER_PALETTE.brand).toBe("#0066CC");
    expect(FOREST_COPPER_PALETTE.copper).toBe("#B7322E");
    expect(FOREST_COPPER_PALETTE.emerald).toBe("#1CB785");
    expect(FOREST_COPPER_PALETTE.navActiveBg).toBe("#EEF4FC");
  });

  it("light theme uses brand on canvas", () => {
    const theme = buildForestCopperTheme("light");
    expect(theme.dark).toBe(false);
    expect(theme.colors.primary).toBe(FOREST_COPPER_PALETTE.brand);
    expect(theme.colors.background).toBe(FOREST_COPPER_PALETTE.canvas);
    expect(theme.colors.error).toBe(EMERGENCY_CODES.red);
  });

  it("dark theme flips background but keeps brand primary", () => {
    const theme = buildForestCopperTheme("dark");
    expect(theme.dark).toBe(true);
    expect(theme.colors.primary).toBe(FOREST_COPPER_PALETTE.brand);
    expect(theme.colors.background).not.toBe(FOREST_COPPER_PALETTE.canvas);
  });

  it("copper is wired as secondary, never primary", () => {
    const theme = buildForestCopperTheme("light");
    expect(theme.colors.secondary).toBe(FOREST_COPPER_PALETTE.copper);
    expect(theme.colors.primary).not.toBe(FOREST_COPPER_PALETTE.copper);
  });

  it("font family slots are populated", () => {
    const theme = buildForestCopperTheme("light");
    expect(theme.fonts.regular.fontFamily).toContain("InterTight");
    expect(theme.fonts.display.fontFamily).toContain("Fraunces");
    expect(theme.fonts.mono.fontFamily).toContain("JetBrainsMono");
  });
});
