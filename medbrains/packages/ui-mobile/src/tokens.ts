/**
 * UI tokens shared across the component library. Mirrors the web
 * MedBrains enterprise palette: System Blue brand, Cinnabar accent,
 * Mint vitals, and Apple-warm neutrals.
 */

export const COLORS = {
  brand: "#0066CC",
  brandHover: "#0052A3",
  brandDeep: "#00182F",
  ink: "#0D0D0C",
  canvas: "#FFFFFF",
  panel: "#F8F8F7",
  rule: "#E7E7E3",
  muted: "#5B5B57",
  copper: "#B7322E",
  accent: "#B7322E",
  accentMuted: "#FDE9E6",
  tint: "#E6F1FF",
  navActiveBg: "#EEF4FC",
  navActiveBgEnd: "#E6F1FF",
  navChildActiveBg: "#E6F1FF",
  navChildActiveText: "#003E7A",
  accentGradientStart: "#0066CC",
  accentGradientMid: "#34D69D",
  accentGradientEnd: "#B7322E",
  emerald: "#1CB785",
  emeraldDim: "rgba(28, 183, 133, 0.25)",
  vital: "#34D69D",
  amber: "#FF9F0A",
  red: "#FF453A",
} as const;

export const APP_BAR = {
  background: COLORS.navActiveBg,
  foreground: COLORS.brand,
  title: COLORS.brandDeep,
  border: COLORS.rule,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export type IntentTone = "neutral" | "info" | "success" | "warn" | "alert" | "copper";

export const INTENT_BG: Record<IntentTone, string> = {
  neutral: COLORS.panel,
  info: "#E0F2FE",
  success: "#D1FAE5",
  warn: "#FEF3C7",
  alert: "#FEE2E2",
  copper: COLORS.accentMuted,
};

export const INTENT_FG: Record<IntentTone, string> = {
  neutral: COLORS.ink,
  info: "#0369A1",
  success: "#047857",
  warn: "#B45309",
  alert: "#B91C1C",
  copper: "#962623",
};
