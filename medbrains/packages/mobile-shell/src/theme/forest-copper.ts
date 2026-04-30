/**
 * Forest + Copper palette ported to React Native Paper v5.
 *
 * The web design system locks these tokens; mobile mirrors them so a
 * patient or clinician sees the same visual identity across surfaces.
 * Copper is reserved for changed values / unread counts / single hero
 * moments — never decoration. See CLAUDE.md "Design System" section.
 */

export const FOREST_COPPER_PALETTE = {
  brand: "#1F4332",
  brandHover: "#153325",
  brandDeep: "#0d2417",
  ink: "#0F1412",
  canvas: "#FFFFFF",
  panel: "#f7f8f6",
  rule: "#e7ebe8",
  copper: "#B8924A",
  tint: "#e4ede9",
  emerald: "#34d399",
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

export interface PaperColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  elevation: { level0: string; level1: string; level2: string; level3: string };
}

export interface PaperTheme {
  dark: boolean;
  roundness: number;
  colors: PaperColors;
  fonts: {
    regular: { fontFamily: string };
    medium: { fontFamily: string };
    bold: { fontFamily: string };
    display: { fontFamily: string };
    mono: { fontFamily: string };
  };
}

export function buildForestCopperTheme(scheme: ColorScheme): PaperTheme {
  const isDark = scheme === "dark";
  const p = FOREST_COPPER_PALETTE;
  return {
    dark: isDark,
    roundness: 8,
    colors: {
      primary: p.brand,
      onPrimary: p.canvas,
      primaryContainer: p.tint,
      onPrimaryContainer: p.brandDeep,
      secondary: p.copper,
      onSecondary: p.canvas,
      secondaryContainer: "#f3ead6",
      onSecondaryContainer: "#553e15",
      background: isDark ? "#0a0d0b" : p.canvas,
      onBackground: isDark ? "#e8ece9" : p.ink,
      surface: isDark ? "#0f1412" : p.canvas,
      onSurface: isDark ? "#e8ece9" : p.ink,
      surfaceVariant: p.panel,
      onSurfaceVariant: "#3a4540",
      outline: p.rule,
      outlineVariant: p.rule,
      error: EMERGENCY_CODES.red,
      onError: p.canvas,
      elevation: {
        level0: "transparent",
        level1: p.panel,
        level2: p.tint,
        level3: p.tint,
      },
    },
    fonts: {
      regular: { fontFamily: "InterTight-Regular" },
      medium: { fontFamily: "InterTight-Medium" },
      bold: { fontFamily: "InterTight-Bold" },
      display: { fontFamily: "Fraunces-Regular" },
      mono: { fontFamily: "JetBrainsMono-Regular" },
    },
  };
}
