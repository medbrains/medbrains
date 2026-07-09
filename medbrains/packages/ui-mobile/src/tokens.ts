/**
 * UI tokens shared across the native component library — now sourced from the single Carbon
 * design-system token core (`@medbrains/design-system/tokens`) instead of a hand-copied palette, so
 * TV / kiosk / mobile render the exact same IBM Carbon colours as the web. Export shape is unchanged
 * for existing consumers; the values are the Carbon ramps.
 */

import { amber, blue, cinnabar, ink, mint, rose, sky } from "@medbrains/design-system/tokens";

export const COLORS = {
  brand: blue[5], // #0f62fe — Carbon interactive
  brandHover: blue[6], // #0043ce
  brandDeep: blue[8], // #001d6c
  ink: ink[10], // #161616
  canvas: ink[0], // #FFFFFF
  panel: ink[1], // #f4f4f4
  rule: ink[2], // #e0e0e0 — border-subtle
  muted: ink[6], // #6f6f6f
  copper: cinnabar[5], // vital-green accent (Carbon; formerly copper red)
  accent: cinnabar[5],
  accentMuted: cinnabar[0], // #defbe6
  tint: blue[0], // #edf5ff — brand tint
  navActiveBg: blue[0],
  navActiveBgEnd: blue[0],
  navChildActiveBg: blue[0],
  navChildActiveText: blue[7], // #002d9c
  accentGradientStart: blue[5],
  accentGradientMid: mint[3], // vital green
  accentGradientEnd: blue[8],
  emerald: mint[4], // #24a148 — Carbon support-success
  emeraldDim: "rgba(36, 161, 72, 0.25)",
  vital: mint[3], // #42be65 — bright vital
  amber: amber[5], // #f1c21b — Carbon warning
  red: rose[5], // #da1e28 — Carbon error
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

// Carbon = sharp corners; keep small values for RN touchables where a hairline radius aids tap feel.
export const RADIUS = {
  sm: 2,
  md: 2,
  lg: 4,
} as const;

export type IntentTone = "neutral" | "info" | "success" | "warn" | "alert" | "copper";

export const INTENT_BG: Record<IntentTone, string> = {
  neutral: COLORS.panel,
  info: sky[0], // #e5f6ff
  success: mint[0], // #defbe6
  warn: amber[0], // #fcf4d6
  alert: rose[0], // #fff1f1
  copper: cinnabar[0],
};

export const INTENT_FG: Record<IntentTone, string> = {
  neutral: COLORS.ink,
  info: sky[6], // #00539a
  success: mint[6], // #198038
  warn: amber[6], // #8e6a00
  alert: rose[6], // #a2191f
  copper: cinnabar[6], // #0e6027
};
