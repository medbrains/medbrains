/**
 * UI tokens shared across the component library. Mirrors the web
 * Forest+Copper system; kept in lockstep with
 * `@medbrains/mobile-shell`'s `theme/forest-copper.ts`.
 */

export const COLORS = {
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
  emeraldDim: "rgba(52, 211, 153, 0.25)",
  red: "#C8102E",
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
  info: "#dde6ea",
  success: COLORS.tint,
  warn: "#fbe9c7",
  alert: "#f5d3d8",
  copper: "#f3ead6",
};

export const INTENT_FG: Record<IntentTone, string> = {
  neutral: COLORS.ink,
  info: "#1d4054",
  success: COLORS.brandDeep,
  warn: "#7a4f0a",
  alert: "#7a0c1a",
  copper: "#553e15",
};
