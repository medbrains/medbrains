import { COLORS } from "@medbrains/ui-mobile/tokens";
import type { MD3Theme } from "react-native-paper";

/**
 * MedBrains enterprise palette ported to React Native Paper v5.
 *
 * The exported names are retained for current shell consumers, but the
 * values are sourced from `@medbrains/ui-mobile` so mobile and TV stay
 * aligned with the locked web design-system anchors.
 */

export const FOREST_COPPER_PALETTE = {
  brand: COLORS.brand,
  brandHover: COLORS.brandHover,
  brandDeep: COLORS.brandDeep,
  ink: COLORS.ink,
  canvas: COLORS.canvas,
  panel: COLORS.panel,
  rule: COLORS.rule,
  muted: COLORS.muted,
  copper: COLORS.copper,
  tint: COLORS.tint,
  navActiveBg: COLORS.navActiveBg,
  navActiveBgEnd: COLORS.navActiveBgEnd,
  navChildActiveBg: COLORS.navChildActiveBg,
  navChildActiveText: COLORS.navChildActiveText,
  accentGradientStart: COLORS.accentGradientStart,
  accentGradientMid: COLORS.accentGradientMid,
  accentGradientEnd: COLORS.accentGradientEnd,
  emerald: COLORS.emerald,
} as const;

export const EMERGENCY_CODES = {
  blue: COLORS.brand,
  red: COLORS.red,
  pink: "#E24C94",
  black: "#0a0a0a",
  yellow: "#E6B422",
  orange: "#E86A1F",
} as const;

export type ColorScheme = "light" | "dark";

export type PaperColors = MD3Theme["colors"];
export type PaperFont = MD3Theme["fonts"]["bodyMedium"];

type PaperFontAlias = {
  fontFamily: string;
  fontWeight?: PaperFont["fontWeight"];
};

export type PaperTheme = MD3Theme & {
  fonts: MD3Theme["fonts"] & {
    regular: PaperFontAlias;
    medium: PaperFontAlias;
    bold: PaperFontAlias;
    display: PaperFontAlias;
    mono: PaperFontAlias;
  };
};

const typography: PaperTheme["fonts"] = {
  default: {
    fontFamily: "InterTight-Regular",
    fontWeight: "400",
    letterSpacing: 0,
  },
  regular: { fontFamily: "InterTight-Regular", fontWeight: "400" },
  medium: { fontFamily: "InterTight-Medium", fontWeight: "500" },
  bold: { fontFamily: "InterTight-Bold", fontWeight: "700" },
  display: { fontFamily: "Fraunces-Regular", fontWeight: "400" },
  mono: { fontFamily: "JetBrainsMono-Regular", fontWeight: "400" },
  displayLarge: {
    fontFamily: "Fraunces-Regular",
    fontSize: 57,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 64,
  },
  displayMedium: {
    fontFamily: "Fraunces-Regular",
    fontSize: 45,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 52,
  },
  displaySmall: {
    fontFamily: "Fraunces-Regular",
    fontSize: 36,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 44,
  },
  headlineLarge: {
    fontFamily: "InterTight-Bold",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40,
  },
  headlineMedium: {
    fontFamily: "InterTight-Bold",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 36,
  },
  headlineSmall: {
    fontFamily: "InterTight-Bold",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 32,
  },
  titleLarge: {
    fontFamily: "InterTight-Medium",
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 28,
  },
  titleMedium: {
    fontFamily: "InterTight-Medium",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.15,
    lineHeight: 24,
  },
  titleSmall: {
    fontFamily: "InterTight-Medium",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  bodyLarge: {
    fontFamily: "InterTight-Regular",
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: "InterTight-Regular",
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0.25,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: "InterTight-Regular",
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  labelLarge: {
    fontFamily: "InterTight-Medium",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  labelMedium: {
    fontFamily: "InterTight-Medium",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  labelSmall: {
    fontFamily: "InterTight-Medium",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
    lineHeight: 16,
  },
};

export function buildForestCopperTheme(scheme: ColorScheme): PaperTheme {
  const isDark = scheme === "dark";
  const p = FOREST_COPPER_PALETTE;
  return {
    dark: isDark,
    isV3: true,
    roundness: 8,
    version: 3,
    animation: { scale: 1 },
    colors: {
      primary: p.brand,
      onPrimary: p.canvas,
      primaryContainer: p.tint,
      onPrimaryContainer: p.brandDeep,
      secondary: p.copper,
      onSecondary: p.canvas,
      secondaryContainer: "#FDE9E6",
      onSecondaryContainer: "#962623",
      tertiary: p.emerald,
      onTertiary: p.canvas,
      tertiaryContainer: "#D1FAE5",
      onTertiaryContainer: "#047857",
      background: isDark ? "#000000" : p.canvas,
      onBackground: isDark ? "#F5F5F7" : p.ink,
      surface: isDark ? "#1C1C1E" : p.canvas,
      onSurface: isDark ? "#F5F5F7" : p.ink,
      surfaceVariant: isDark ? "#2C2C2E" : p.panel,
      onSurfaceVariant: isDark ? "#C7C7CC" : p.muted,
      surfaceDisabled: isDark ? "rgba(245, 245, 247, 0.12)" : "rgba(13, 13, 12, 0.12)",
      onSurfaceDisabled: isDark ? "rgba(245, 245, 247, 0.38)" : "rgba(13, 13, 12, 0.38)",
      outline: isDark ? "#3A3A3C" : p.rule,
      outlineVariant: isDark ? "#2C2C2E" : p.rule,
      error: EMERGENCY_CODES.red,
      onError: p.canvas,
      errorContainer: "#FEE2E2",
      onErrorContainer: "#B91C1C",
      inverseSurface: isDark ? "#F5F5F7" : p.ink,
      inverseOnSurface: isDark ? p.ink : p.panel,
      inversePrimary: isDark ? "#4495FF" : p.brandHover,
      shadow: "#000000",
      scrim: "#000000",
      backdrop: "rgba(13, 13, 12, 0.36)",
      elevation: {
        level0: "transparent",
        level1: isDark ? "#1C1C1E" : p.panel,
        level2: isDark ? "#2C2C2E" : p.tint,
        level3: isDark ? "#2C2C2E" : p.tint,
        level4: isDark ? "#3A3A3C" : p.tint,
        level5: isDark ? "#3A3A3C" : p.tint,
      },
    },
    fonts: typography,
  };
}
