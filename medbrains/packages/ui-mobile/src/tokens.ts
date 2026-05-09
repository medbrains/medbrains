/**
 * UI tokens shared across the component library. Mirrors the web
 * MedBrains clinical teal + copper system; kept in lockstep with
 * `@medbrains/mobile-shell`'s `theme/forest-copper.ts`.
 */

export const COLORS = {
  brand: "#0F766E",
  brandHover: "#0d6b63",
  brandDeep: "#042f2e",
  ink: "#0F1412",
  canvas: "#FFFFFF",
  panel: "#f8fafc",
  rule: "#e2e8f0",
  copper: "#B8924A",
  tint: "#d1fae5",
  navActiveBg: "#ccfbf1",
  navActiveBgEnd: "#e0f2fe",
  navChildActiveBg: "#e0f2fe",
  navChildActiveText: "#0369a1",
  accentGradientStart: "#14b8a6",
  accentGradientMid: "#0ea5e9",
  accentGradientEnd: "#f59e0b",
  emerald: "#10b981",
  emeraldDim: "rgba(16, 185, 129, 0.25)",
  red: "#C8102E",
} as const;

export const APP_BAR = {
  background: COLORS.navActiveBg,
  foreground: COLORS.brand,
  title: COLORS.brandDeep,
  border: "#dcebe8",
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
  info: "#e0f2fe",
  success: COLORS.tint,
  warn: "#fef3c7",
  alert: "#ffe4e6",
  copper: "#f3ead6",
};

export const INTENT_FG: Record<IntentTone, string> = {
  neutral: COLORS.ink,
  info: "#075985",
  success: COLORS.brandDeep,
  warn: "#92400e",
  alert: "#9f1239",
  copper: "#553e15",
};
