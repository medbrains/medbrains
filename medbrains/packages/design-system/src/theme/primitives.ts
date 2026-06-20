/**
 * MedBrains Design System — Tier 1: Primitive Tokens
 *
 * Raw, context-free design values. Never reference these directly in
 * components or SCSS. Use the semantic tokens (`semantic.ts`) which
 * map these primitives to meaningful roles for light + dark schemes.
 *
 * Brand identity (LOCKED 2026-05-30):
 *   • Brand   — System Blue, anchor #0066CC (institutional clinical)
 *   • Accent  — Cinnabar,    anchor #B7322E (Apple "most-personal" reserved)
 *   • Vital   — Mint,        anchor #34D69D (vital signs, success, ECG)
 *   • Ink     — Apple-warm gray ramp (#0D0D0C → #F8F8F7)
 *
 * Architecture: Apple HIG type/spacing + Material 3 elevation + Fluent 2
 * neutral rigor. Each ramp has 10 stops (50 → 900) for precise contrast
 * tuning per mode.
 */

import type { MantineColorsTuple } from "@mantine/core";

// ═══════════════════════════════════════════════════════════════════
// ── Color Ramps
// ═══════════════════════════════════════════════════════════════════

/** Blue — IBM Carbon interactive. Anchor: blue[5] = Blue 60 #0f62fe. */
export const blue = [
  "#edf5ff", // 10
  "#d0e2ff", // 20
  "#a6c8ff", // 30
  "#78a9ff", // 40 — dark-mode brand fg
  "#4589ff", // 50 — dark-mode brand emphasis
  "#0f62fe", // 60 — LIGHT brand (Carbon interactive)
  "#0043ce", // 70 — link hover / pressed
  "#002d9c", // 80 — deep pressed
  "#001d6c", // 90
  "#001141", // 100
] as const satisfies readonly string[];

/**
 * Vital green — the brand's second colour (Lazarus / life-signs ECG beat),
 * paired with IBM blue. Anchor [5] = vital green #42be65. Export name kept as
 * `cinnabar` for import stability; it is no longer red/purple.
 */
export const cinnabar = [
  "#defbe6", // 10 — green tint (accent bg)
  "#a7f0ba", // 20
  "#6fdc8c", // 30
  "#74e792", // 40 — light beat (dark-scheme accent fg)
  "#42be65", // 50 — dark-scheme emphasis
  "#42be65", // 60 — vital green accent (emphasis) ★
  "#0e6027", // 70 — readable on white (accent fg)
  "#044317", // 80
  "#022d0d", // 90
  "#071908", // 100
] as const satisfies readonly string[];

/** Carbon brand gradient — Blue 90 → 60 → 50 → 30. */
export const signatureSpectrumStops = ["#001d6c", "#0f62fe", "#4589ff", "#a6c8ff"] as const;

/** Green — Carbon support-success. Anchor: mint[4] = Green 50 #24a148 (ECG/vital). */
export const mint = [
  "#defbe6", // 10
  "#a7f0ba", // 20
  "#6fdc8c", // 30
  "#42be65", // 40 — bright vital
  "#24a148", // 50 — VITAL / ECG anchor (Carbon support-success)
  "#198038", // 60 — SUCCESS emphasis
  "#0e6027", // 70
  "#044317", // 80
  "#022d0d", // 90
  "#08130b", // 100
] as const satisfies readonly string[];

/**
 * Emerald alias — kept for legacy semantic imports. Same ramp as mint.
 * (Existing modules import `emerald` for ECG / success roles; we route to mint.)
 */
export const emerald = mint;

/** Gray — IBM Carbon neutral. Pure white at 0 → Gray 100 #161616. */
export const ink = [
  "#FFFFFF", // 0  — pure canvas (light)
  "#f4f4f4", // 10 — paper / layer-01
  "#e0e0e0", // 20 — hairline / border-subtle
  "#c6c6c6", // 30 — divider
  "#a8a8a8", // 40 — placeholder / faint fg
  "#8d8d8d", // 50 — border-strong / subtle fg
  "#6f6f6f", // 60 — helper / muted fg
  "#525252", // 70 — secondary text
  "#393939", // 80 — body emphasis
  "#262626", // 90 — body
  "#161616", // 100 — primary fg, headings (Carbon Gray 100)
] as const satisfies readonly string[];

/**
 * Ink dark — Apple-style pure-black canvas with system grays. Used to
 * populate dark scheme; mirrors `ink` indices but for dark mode roles
 * (canvas/panel/subtle/etc.).
 */
export const inkDark = [
  "#F5F5F7", // 0  — primary fg on dark (Apple system gray-6 inverse)
  "#E5E5EA", // 1  — secondary fg on dark
  "#C7C7CC", // 2  — muted fg
  "#8E8E93", // 3  — subtle fg
  "#636366", // 4  — faint fg / strong border
  "#48484A", // 5  — border strong
  "#3A3A3C", // 6  — border default
  "#2C2C2E", // 7  — bg subtle / border muted
  "#1C1C1E", // 8  — bg panel
  "#000000", // 9  — bg canvas (Apple pure black)
] as const satisfies readonly string[];

/** Yellow — Carbon support-warning. Anchor: amber[5] = #f1c21b. */
export const amber = [
  "#fcf4d6",
  "#fddc69",
  "#f1c21b",
  "#d2a106",
  "#b28600",
  "#f1c21b", // 5 — Carbon warning (dark text on top)
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
  "#da1e28", // 5 — Carbon error
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
  "#0072c3", // 5 — Carbon info
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
  "#5E5CE6", // 5 — Apple system indigo (AI/premium)
  "#4B4ABD",
  "#383894",
  "#26266B",
  "#141342",
] as const satisfies readonly string[];

/** Ochre — warm engagement (billing, revenue). Kept Tailwind-derived. */
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

/** Teal — healthcare-adjacent calm. Kept Tailwind-derived. */
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

/** Slate — cool neutral. Reserved for dim chrome. Kept Tailwind-derived. */
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

// ═══════════════════════════════════════════════════════════════════
// ── Mantine Tuples
// ═══════════════════════════════════════════════════════════════════

export const blueTuple: MantineColorsTuple = [...blue] as unknown as MantineColorsTuple;
export const cinnabarTuple: MantineColorsTuple = [...cinnabar] as unknown as MantineColorsTuple;
export const mintTuple: MantineColorsTuple = [...mint] as unknown as MantineColorsTuple;
export const amberTuple: MantineColorsTuple = [...amber] as unknown as MantineColorsTuple;
export const roseTuple: MantineColorsTuple = [...rose] as unknown as MantineColorsTuple;
export const skyTuple: MantineColorsTuple = [...sky] as unknown as MantineColorsTuple;
export const violetTuple: MantineColorsTuple = [...violet] as unknown as MantineColorsTuple;
export const ochreTuple: MantineColorsTuple = [...ochre] as unknown as MantineColorsTuple;
export const tealTuple: MantineColorsTuple = [...teal] as unknown as MantineColorsTuple;
export const slateTuple: MantineColorsTuple = [...slate] as unknown as MantineColorsTuple;

/**
 * Legacy alias — anything still importing `emeraldTuple` resolves to mint.
 */
export const emeraldTuple: MantineColorsTuple = mintTuple;

// ═══════════════════════════════════════════════════════════════════
// ── Spacing — 4px grid
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// ── Radius — Apple-style continuous corners
// ═══════════════════════════════════════════════════════════════════

// IBM Carbon — sharp, functional corners.
export const radius = {
  none: "0",
  xs: "0",
  sm: "2px",
  md: "2px",
  lg: "4px",
  xl: "6px",
  "2xl": "8px",
  "3xl": "12px",
  full: "9999px",
} as const;

// ═══════════════════════════════════════════════════════════════════
// ── Type Scale — Apple-inspired
// ═══════════════════════════════════════════════════════════════════
//
// Apple's HIG ladder mapped onto Inter Tight / Fraunces. Headlines use
// Fraunces variable axis (optical-size aware); body/control use Inter
// Tight; metadata uses JetBrains Mono.

export const fontSize = {
  xs: "11px", // caption / eyebrow caps
  sm: "12px", // footnote, dense table
  md: "14px", // body default (clinical density)
  lg: "16px", // callout
  xl: "18px", // headline
  "2xl": "20px", // title 3
  "3xl": "24px", // title 2
  "4xl": "28px", // title 1
  "5xl": "36px", // large title
  "6xl": "48px", // display
  "7xl": "56px", // hero
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

// ═══════════════════════════════════════════════════════════════════
// ── Font Stacks
// ═══════════════════════════════════════════════════════════════════

export const fontFamily = {
  sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Tamil', sans-serif",
  display: "'IBM Plex Sans', 'IBM Plex Serif', Georgia, serif",
  mono: "'IBM Plex Mono', 'SF Mono', ui-monospace, Menlo, monospace",
} as const;

// ═══════════════════════════════════════════════════════════════════
// ── Shadows — Apple ambient + key dual-layer
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// ── Motion — Apple springs + Material curves
// ═══════════════════════════════════════════════════════════════════

export const duration = {
  instant: "0ms",
  fast: "120ms",
  medium: "200ms",
  slow: "320ms",
  slower: "480ms",
  ambient: "640ms",
} as const;

export const easing = {
  /** Apple standard — neutral entrance/exit */
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  /** Material emphasized — branded feedback */
  emphasis: "cubic-bezier(0.3, 0, 0, 1)",
  /** Spring — natural arrival */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Decelerate — entering view */
  decel: "cubic-bezier(0, 0, 0, 1)",
  /** Accelerate — leaving view */
  accel: "cubic-bezier(0.3, 0, 1, 1)",
  /** Linear — progress, ECG, indeterminate loops */
  linear: "linear",
} as const;

// ═══════════════════════════════════════════════════════════════════
// ── Z-index
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// ── Emergency Code Layer (NOT themeable — patient safety critical)
// ═══════════════════════════════════════════════════════════════════
//
// Identical on every deployment regardless of theme. Operators rely on
// muscle memory for these colors during emergencies.

export const emergencyCodes = {
  blue: "#1E63B8", // cardiac
  red: "#C8102E", // fire
  pink: "#E24C94", // abduction
  black: "#0A0A0A", // bomb
  yellow: "#E6B422", // disaster
  orange: "#E86A1F", // hazmat
} as const;
