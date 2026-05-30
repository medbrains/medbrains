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

/** Blue — System Blue brand. Anchor: blue[5] = #0066CC. */
export const blue = [
  "#E6F1FF", // 50
  "#BCDAFF", // 100
  "#80B8FF", // 200
  "#4495FF", // 300 — dark-mode brand fg
  "#1A7CFF", // 400 — dark-mode brand emphasis
  "#0066CC", // 500 — LIGHT brand (LOCKED anchor)
  "#0052A3", // 600 — light hover, dark fg
  "#003E7A", // 700 — pressed
  "#002B54", // 800
  "#00182F", // 900
] as const satisfies readonly string[];

/** Cinnabar — reserved accent. Anchor: cinnabar[5] = #B7322E. */
export const cinnabar = [
  "#FDE9E6", // 50
  "#FBC8C0", // 100
  "#F29C8E", // 200
  "#E9705B", // 300 — dark-mode accent fg
  "#D44A36", // 400 — dark-mode accent emphasis
  "#B7322E", // 500 — LIGHT accent (LOCKED anchor)
  "#962623", // 600
  "#6F1C1A", // 700
  "#491110", // 800
  "#260807", // 900
] as const satisfies readonly string[];

/** Mint — Apple Health vital sign / success. Anchor: mint[4] = #34D69D. */
export const mint = [
  "#E3FAF2", // 50
  "#B4F1DC", // 100
  "#84E5C3", // 200
  "#54D6A8", // 300
  "#34D69D", // 400 — VITAL anchor (ECG, normal sign)
  "#1CB785", // 500 — SUCCESS anchor
  "#149367", // 600
  "#0F6F4D", // 700
  "#094A33", // 800
  "#042619", // 900
] as const satisfies readonly string[];

/**
 * Emerald alias — kept for legacy semantic imports. Same ramp as mint.
 * (Existing modules import `emerald` for ECG / success roles; we route to mint.)
 */
export const emerald = mint;

/** Ink — Apple-warm neutral. Anchor: pure white at 0, near-black at 900. */
export const ink = [
  "#FFFFFF", // 0  — pure canvas (light)
  "#F8F8F7", // 50 — paper
  "#EDEDEC", // 100 — fog panel
  "#D8D8D6", // 200 — hairline borders
  "#B8B8B5", // 300 — strong borders, dividers
  "#8A8A86", // 400 — faint fg
  "#5B5B57", // 500 — subtle fg
  "#3D3D3A", // 600 — muted fg
  "#282826", // 700 — secondary
  "#1A1A18", // 800 — body
  "#0D0D0C", // 900 — primary fg, headings (LOCKED anchor)
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

/** Amber — Apple system warning. Anchor: amber[5] = #FF9F0A. */
export const amber = [
  "#FFF8E1",
  "#FFECB3",
  "#FFE082",
  "#FFD54F",
  "#FFCA28",
  "#FF9F0A", // 5 — Apple system orange (warning)
  "#D97706",
  "#B45309",
  "#92400E",
  "#78350F",
] as const satisfies readonly string[];

/** Rose — Apple system critical. Anchor: rose[5] = #FF453A. */
export const rose = [
  "#FFE5E3",
  "#FFCCC8",
  "#FFA8A1",
  "#FF8076",
  "#FF6961",
  "#FF453A", // 5 — Apple system red (critical alert)
  "#D70015",
  "#A30210",
  "#75020B",
  "#4D0107",
] as const satisfies readonly string[];

/** Sky — Apple system informational. Anchor: sky[5] = #0A84FF. */
export const sky = [
  "#E6F2FF",
  "#BDE0FF",
  "#90CBFF",
  "#64B5FF",
  "#3D9DFF",
  "#0A84FF", // 5 — Apple system blue (info)
  "#0066CC",
  "#0052A3",
  "#003E7A",
  "#002B54",
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
export const cinnabarTuple: MantineColorsTuple = [
  ...cinnabar,
] as unknown as MantineColorsTuple;
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

export const radius = {
  none: "0",
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  "3xl": "28px",
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
  sans: "'Inter Tight Variable', 'Inter Tight', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Noto Sans', 'Noto Sans Tamil', Roboto, sans-serif",
  display:
    "'Fraunces Variable', 'Fraunces', 'SF Pro Display', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
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
