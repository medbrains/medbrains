/**
 * MedBrains Design System — framework-agnostic token core.
 *
 * Pure data: no `@mantine/core`, no React, no runtime deps. This is the single source of colour /
 * type / spacing values that BOTH the web (Mantine, via `primitives.ts`) and the native device apps
 * (React Native Paper, via `@medbrains/design-system/tokens`) consume — so TV / kiosk / mobile share
 * the exact same IBM Carbon palette as the web instead of re-declaring their own.
 *
 * Brand identity (LOCKED 2026-05-30): Brand = System Blue #0f62fe · Vital = Mint #42be65 ·
 * Ink = Carbon neutral ramp. See `primitives.ts` for the Mantine tuple wrappers.
 */

/** Blue — IBM Carbon interactive. Anchor: blue[5] = Blue 60 #0f62fe. */
export const blue = [
  "#edf5ff",
  "#d0e2ff",
  "#a6c8ff",
  "#78a9ff",
  "#4589ff",
  "#0f62fe",
  "#0043ce",
  "#002d9c",
  "#001d6c",
  "#001141",
] as const satisfies readonly string[];

/** Vital green — the brand's second colour (life-signs ECG beat). Anchor [5] = #42be65. */
export const cinnabar = [
  "#defbe6",
  "#a7f0ba",
  "#6fdc8c",
  "#74e792",
  "#42be65",
  "#42be65",
  "#0e6027",
  "#044317",
  "#022d0d",
  "#071908",
] as const satisfies readonly string[];

/** Carbon brand gradient — Blue 90 → 60 → 50 → 30. */
export const signatureSpectrumStops = ["#001d6c", "#0f62fe", "#4589ff", "#a6c8ff"] as const;

/** Green — Carbon support-success. Anchor: mint[4] = Green 50 #24a148 (ECG/vital). */
export const mint = [
  "#defbe6",
  "#a7f0ba",
  "#6fdc8c",
  "#42be65",
  "#24a148",
  "#198038",
  "#0e6027",
  "#044317",
  "#022d0d",
  "#08130b",
] as const satisfies readonly string[];

/** Emerald alias — kept for legacy semantic imports. Same ramp as mint. */
export const emerald = mint;

/** Gray — IBM Carbon neutral. Pure white at 0 → Gray 100 #161616. */
export const ink = [
  "#FFFFFF",
  "#f4f4f4",
  "#e0e0e0",
  "#c6c6c6",
  "#a8a8a8",
  "#8d8d8d",
  "#6f6f6f",
  "#525252",
  "#393939",
  "#262626",
  "#161616",
] as const satisfies readonly string[];

/** Ink dark — Apple-style pure-black canvas with system grays (dark scheme). */
export const inkDark = [
  "#F5F5F7",
  "#E5E5EA",
  "#C7C7CC",
  "#8E8E93",
  "#636366",
  "#48484A",
  "#3A3A3C",
  "#2C2C2E",
  "#1C1C1E",
  "#000000",
] as const satisfies readonly string[];

/** Yellow — Carbon support-warning. Anchor: amber[5] = #f1c21b. */
export const amber = [
  "#fcf4d6",
  "#fddc69",
  "#f1c21b",
  "#d2a106",
  "#b28600",
  "#f1c21b",
  "#8e6a00",
  "#684e00",
  "#483700",
  "#302400",
] as const satisfies readonly string[];

/** Red — Carbon support-error. Anchor: rose[5] = Red 60 #da1e28. */
export const rose = [
  "#fff1f1",
  "#ffd7d9",
  "#ffb3b8",
  "#ff8389",
  "#fa4d56",
  "#da1e28",
  "#a2191f",
  "#750e13",
  "#520408",
  "#2d0709",
] as const satisfies readonly string[];

/** Cyan — Carbon support-info. Anchor: sky[5] = Cyan 60 #0072c3. */
export const sky = [
  "#e5f6ff",
  "#bae6ff",
  "#82cfff",
  "#33b1ff",
  "#1192e8",
  "#0072c3",
  "#00539a",
  "#003a6d",
  "#012749",
  "#061727",
] as const satisfies readonly string[];

/** Violet — Apple system premium / AI. Anchor: violet[5] = #5E5CE6. */
export const violet = [
  "#EFEEFF",
  "#D7D5FF",
  "#B8B5FF",
  "#9591FF",
  "#7472FF",
  "#5E5CE6",
  "#4B4ABD",
  "#383894",
  "#26266B",
  "#141342",
] as const satisfies readonly string[];

/** Ochre — warm engagement (billing, revenue). */
export const ochre = [
  "#FFF7ED",
  "#FFEDD5",
  "#FED7AA",
  "#FDBA74",
  "#FB923C",
  "#F97316",
  "#EA580C",
  "#C2410C",
  "#9A3412",
  "#7C2D12",
] as const satisfies readonly string[];

/** Teal — healthcare-adjacent calm. */
export const teal = [
  "#F0FDFA",
  "#CCFBF1",
  "#99F6E4",
  "#5EEAD4",
  "#2DD4BF",
  "#14B8A6",
  "#0D9488",
  "#0F766E",
  "#115E59",
  "#134E4A",
] as const satisfies readonly string[];

/** Slate — cool neutral. Reserved for dim chrome. */
export const slate = [
  "#F8FAFC",
  "#F1F5F9",
  "#E2E8F0",
  "#CBD5E1",
  "#94A3B8",
  "#64748B",
  "#475569",
  "#334155",
  "#1E293B",
  "#0F172A",
] as const satisfies readonly string[];

/** Spacing — 4px grid. */
export const space = {
  "3xs": "4px",
  "2xs": "8px",
  xs: "10px",
  sm: "12px",
  md: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
  "4xl": "56px",
  "5xl": "72px",
} as const;

/** Radius — IBM Carbon sharp corners (all 0; only `full` for circles). */
export const radius = {
  none: "0",
  xs: "0",
  sm: "0",
  md: "0",
  lg: "0",
  xl: "0",
  "2xl": "0",
  "3xl": "0",
  full: "9999px",
} as const;

/** Type scale — 16px body base, proportional. */
export const fontSize = {
  xs: "13px",
  sm: "14px",
  md: "17px",
  lg: "19px",
  xl: "21px",
  "2xl": "23px",
  "3xl": "27px",
  "4xl": "33px",
  "5xl": "40px",
  "6xl": "52px",
  "7xl": "62px",
} as const;

export const lineHeight = {
  none: "1",
  display: "1.04",
  tight: "1.1",
  snug: "1.25",
  normal: "1.45",
  relaxed: "1.6",
  loose: "1.75",
} as const;

export const fontWeight = {
  thin: "200",
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const letterSpacing = {
  tightest: "-0.04em",
  tighter: "-0.02em",
  tight: "-0.01em",
  normal: "0",
  wide: "0.02em",
  caps: "0.08em",
  capsLoose: "0.14em",
} as const;

/** Font stacks. Web uses IBM Plex; native apps map these to their installed RN font families. */
export const fontFamily = {
  sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Tamil', sans-serif",
  display: "'IBM Plex Sans', 'IBM Plex Serif', Georgia, serif",
  mono: "'IBM Plex Mono', 'SF Mono', ui-monospace, Menlo, monospace",
} as const;

export const shadowLight = {
  xs: "0 1px 2px rgba(13, 13, 12, 0.04), 0 1px 3px rgba(13, 13, 12, 0.04)",
  sm: "0 1px 3px rgba(13, 13, 12, 0.05), 0 4px 8px rgba(13, 13, 12, 0.04)",
  md: "0 2px 4px rgba(13, 13, 12, 0.04), 0 8px 20px rgba(13, 13, 12, 0.06)",
  lg: "0 4px 8px rgba(13, 13, 12, 0.05), 0 12px 32px rgba(13, 13, 12, 0.08)",
  xl: "0 8px 16px rgba(13, 13, 12, 0.06), 0 20px 48px rgba(13, 13, 12, 0.10)",
  "2xl": "0 16px 32px rgba(13, 13, 12, 0.08), 0 32px 80px rgba(13, 13, 12, 0.14)",
} as const;

export const shadowDark = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.32), 0 1px 3px rgba(0, 0, 0, 0.20)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.40), 0 4px 8px rgba(0, 0, 0, 0.24)",
  md: "0 2px 4px rgba(0, 0, 0, 0.44), 0 8px 20px rgba(0, 0, 0, 0.32)",
  lg: "0 4px 8px rgba(0, 0, 0, 0.48), 0 12px 32px rgba(0, 0, 0, 0.36)",
  xl: "0 8px 16px rgba(0, 0, 0, 0.52), 0 20px 48px rgba(0, 0, 0, 0.40)",
  "2xl": "0 16px 32px rgba(0, 0, 0, 0.56), 0 32px 80px rgba(0, 0, 0, 0.48)",
} as const;

export const duration = {
  instant: "0ms",
  fast: "120ms",
  medium: "200ms",
  slow: "320ms",
  slower: "480ms",
  ambient: "640ms",
} as const;

export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasis: "cubic-bezier(0.3, 0, 0, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  decel: "cubic-bezier(0, 0, 0, 1)",
  accel: "cubic-bezier(0.3, 0, 1, 1)",
  linear: "linear",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  appShell: 200,
  topProgress: 250,
  dropdown: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  spotlight: 900,
  max: 1000,
} as const;

/**
 * Emergency Code Layer — NOT themeable, patient-safety critical. Identical on every deployment and
 * every device; operators rely on muscle memory. Single source; RN + web both import from here.
 */
export const emergencyCodes = {
  blue: "#1E63B8", // cardiac
  red: "#C8102E", // fire
  pink: "#E24C94", // abduction
  black: "#0A0A0A", // bomb
  yellow: "#E6B422", // disaster
  orange: "#E86A1F", // hazmat
} as const;
