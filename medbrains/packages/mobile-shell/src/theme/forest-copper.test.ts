import { describe, expect, it } from "vitest";
import {
  EMERGENCY_CODES,
  FOREST_COPPER_PALETTE,
  buildForestCopperTheme,
} from "./forest-copper.js";

describe("buildForestCopperTheme", () => {
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
