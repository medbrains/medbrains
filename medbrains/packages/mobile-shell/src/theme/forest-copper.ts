import type { MD3Theme } from "react-native-paper";

/**
 * MedBrains clinical teal + copper palette ported to React Native Paper v5.
 *
 * The web design system locks these tokens; mobile mirrors them so a
 * patient or clinician sees the same visual identity across surfaces.
 * Copper is reserved for changed values / unread counts / single hero
 * moments — never decoration. See CLAUDE.md "Design System" section.
 */

export const FOREST_COPPER_PALETTE = {
  brand: "#0F766E",
  brandHover: "#0d6b63",
  brandDeep: "#042f2e",
  ink: "#0F1412",
  canvas: "#FFFFFF",
  panel: "#f8fafc",
  rule: "#e2e8f0",
  muted: "#64748b",
  copper: "#B8924A",
  tint: "#d1fae5",
  emerald: "#10b981",
} as const;

export const EMERGENCY_CODES = {
  blue: "#1E63B8",
  red: "#C8102E",
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
      secondaryContainer: "#f3ead6",
      onSecondaryContainer: "#553e15",
      tertiary: p.emerald,
      onTertiary: p.brandDeep,
      tertiaryContainer: "#d7f8e9",
      onTertiaryContainer: p.brandDeep,
      background: isDark ? "#0a0d0b" : p.canvas,
      onBackground: isDark ? "#e8ece9" : p.ink,
      surface: isDark ? "#0f1412" : p.canvas,
      onSurface: isDark ? "#e8ece9" : p.ink,
      surfaceVariant: p.panel,
      onSurfaceVariant: "#3a4540",
      surfaceDisabled: isDark ? "rgba(232, 236, 233, 0.12)" : "rgba(15, 20, 18, 0.12)",
      onSurfaceDisabled: isDark ? "rgba(232, 236, 233, 0.38)" : "rgba(15, 20, 18, 0.38)",
      outline: p.rule,
      outlineVariant: p.rule,
      error: EMERGENCY_CODES.red,
      onError: p.canvas,
      errorContainer: "#fde7ea",
      onErrorContainer: "#5a0815",
      inverseSurface: isDark ? "#e8ece9" : "#223027",
      inverseOnSurface: isDark ? p.ink : "#eef4ef",
      inversePrimary: isDark ? "#9fc8b2" : "#7fb39a",
      shadow: "#000000",
      scrim: "#000000",
      backdrop: "rgba(31, 67, 50, 0.4)",
      elevation: {
        level0: "transparent",
        level1: p.panel,
        level2: p.tint,
        level3: p.tint,
        level4: p.tint,
        level5: p.tint,
      },
    },
    fonts: typography,
  };
}
