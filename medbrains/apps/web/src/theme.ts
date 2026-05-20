import {
  Card,
  Container,
  type CSSVariablesResolver,
  createTheme,
  Loader,
  type MantineColorsTuple,
  Paper,
  rem,
  Select,
} from "@mantine/core";
import { EcgLoader } from "./components/EcgLoader";

// ═══════════════════════════════════════════════════════════════════
// ── MedBrains Design System: Vibrant Clinical
// ═══════════════════════════════════════════════════════════════════
//
// Brand: clinical teal-green (#0F766E)
// Accent: copper (#B8924A), sky, violet, and orange for visual variety
// Canvas: bright white-first clinical workspace
// Ink: graphite (#0F1412) — never #000000
//
// Peers: Mayo Clinic, Roche, Patagonia-medical, Hermes
// Fonts: IBM Plex Sans (UI), Noto Sans family (multilingual fallback), JetBrains Mono (code)
// ═══════════════════════════════════════════════════════════════════

export type MedBrainsColorSchemeId =
  | "clinical_teal_copper"
  | "hospital_navy_mint"
  | "clean_blue_green"
  | "surgical_graphite_aqua"
  | "public_health_green_blue";

export type MedBrainsFontSchemeId =
  | "manrope_nunito"
  | "nunito_manrope"
  | "system_premium"
  | "previous_ibm_plex";

export const ACTIVE_COLOR_SCHEME: MedBrainsColorSchemeId = "clinical_teal_copper";
export const ACTIVE_FONT_SCHEME: MedBrainsFontSchemeId = "previous_ibm_plex";

const clinicalTeal: MantineColorsTuple = [
  "#edf8f8",
  "#d6eeee",
  "#acdcdc",
  "#7ec6c6",
  "#4daaaa",
  "#0B5D6B",
  "#084C5A",
  "#063e49",
  "#042f38",
  "#03252c",
];

const hospitalNavy: MantineColorsTuple = [
  "#eef5fb",
  "#d9e8f4",
  "#b6d1e7",
  "#8eb5d6",
  "#6294bf",
  "#1F4E79",
  "#173E61",
  "#12314d",
  "#0d253a",
  "#081a28",
];

const cleanBlue: MantineColorsTuple = [
  "#eef4ff",
  "#dbe7ff",
  "#b8cffd",
  "#8fb2f7",
  "#5f8fed",
  "#315C9B",
  "#284b80",
  "#203d68",
  "#182f50",
  "#102139",
];

const surgicalAqua: MantineColorsTuple = [
  "#f1f5f8",
  "#dde7ee",
  "#bccfdc",
  "#94b0c1",
  "#688da3",
  "#2F4858",
  "#263a47",
  "#1e2e38",
  "#16232b",
  "#101a20",
];

const publicHealthGreen: MantineColorsTuple = [
  "#eef8f2",
  "#d9efe2",
  "#b6dfc9",
  "#8ecbad",
  "#62b389",
  "#2E6F54",
  "#245a43",
  "#1d4836",
  "#153628",
  "#0f291f",
];

// Success — Clinical Green (normal vitals, healthy, completed)
const success: MantineColorsTuple = [
  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981", // emerald
  "#059669",
  "#047857",
  "#065f46",
  "#064e3b",
];

// Warning — Clinical Amber (abnormal values, pending)
const warning: MantineColorsTuple = [
  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b", // amber
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",
];

// Danger — Clinical Rose (critical alerts, emergencies)
const danger: MantineColorsTuple = [
  "#fff1f2",
  "#ffe4e6",
  "#fecdd3",
  "#fda4af",
  "#fb7185",
  "#f43f5e", // rose
  "#e11d48",
  "#be123c",
  "#9f1239",
  "#881337",
];

// Info — Sky Blue (informational, data, neutral-cool)
const info: MantineColorsTuple = [
  "#f0f9ff",
  "#e0f2fe",
  "#bae6fd",
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#075985",
  "#0c4a6e",
];

// Violet — Purple (premium, AI, smart features)
const violet: MantineColorsTuple = [
  "#f5f3ff",
  "#ede9fe",
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#4c1d95",
];

// Orange — Warm (billing, revenue, engagement)
const orange: MantineColorsTuple = [
  "#fff7ed",
  "#ffedd5",
  "#fed7aa",
  "#fdba74",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#c2410c",
  "#9a3412",
  "#7c2d12",
];

// Teal — Healthcare (clinical, calm, trust)
const teal: MantineColorsTuple = [
  "#f0fdfa",
  "#ccfbf1",
  "#99f6e4",
  "#5eead4",
  "#2dd4bf",
  "#14b8a6",
  "#0d9488",
  "#0f766e",
  "#115e59",
  "#134e4a",
];

// Slate — Elevated Neutral (subtle UI, backgrounds, borders)
const slate: MantineColorsTuple = [
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#334155",
  "#1e293b",
  "#0f172a",
];

// Copper — Reserved accent (changed values, unread, hero moment)
const copper: MantineColorsTuple = [
  "#faf6ef",
  "#f1e4c8",
  "#e5cf9e",
  "#d4b574",
  "#c9a35a",
  "#B8924A", // 5 <- copper accent
  "#9a7a3d",
  "#7d5f22",
  "#604716",
  "#3d2d0c",
];

interface MedBrainsColorScheme {
  label: string;
  primary: MantineColorsTuple;
  accentScale: MantineColorsTuple;
  secondary: string;
  accent: string;
  accentDeep: string;
  canvas: string;
  content: string;
  panel: string;
  surface: string;
  sidebarBg: string;
  headerBg: string;
  inputBg: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  activeBg: string;
  activeBgStrong: string;
  activeBorder: string;
  activeText: string;
  navHoverBg: string;
  navHoverText: string;
  navActiveBg: string;
  navActiveText: string;
  navActiveShadow: string;
  navChildActiveBg: string;
  navChildActiveText: string;
  navChildActiveBorder: string;
  searchBg: string;
  tableHeaderBg: string;
  tableHover: string;
  tableBorder: string;
  shimmerFrom: string;
  shimmerMid: string;
  iconGlow: string;
  accentGradient: string;
  accentGradientSoft: string;
  floatShadow: string;
  cardHoverShadow: string;
}

export const COLOR_SCHEMES: Record<MedBrainsColorSchemeId, MedBrainsColorScheme> = {
  clinical_teal_copper: {
    label: "Executive Charcoal + Teal",
    primary: clinicalTeal,
    accentScale: copper,
    secondary: "#188A75",
    accent: "#A6722A",
    accentDeep: "#6f4a16",
    canvas: "#ffffff",
    content: "linear-gradient(135deg, #f8fbfb 0%, #f1f8f7 52%, #fff9ed 100%)",
    panel: "#f4f7f7",
    surface: "#ffffff",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #eef8f7 46%, #fff7e8 100%)",
    headerBg:
      "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(246,251,251,0.9) 58%, rgba(255,249,237,0.88) 100%)",
    inputBg: "#ffffff",
    border: "#d7e3e2",
    borderSubtle: "#e8f0ef",
    textPrimary: "#111A1C",
    textSecondary: "#34474A",
    textMuted: "#66777A",
    textFaint: "#bfcbcd",
    activeBg: "#d6eeee",
    activeBgStrong: "#acdcdc",
    activeBorder: "#0B5D6B",
    activeText: "#084C5A",
    navHoverBg: "rgba(11, 93, 107, 0.08)",
    navHoverText: "#084C5A",
    navActiveBg: "linear-gradient(135deg, rgba(214,238,238,0.95) 0%, rgba(255,250,240,0.9) 100%)",
    navActiveText: "#084C5A",
    navActiveShadow: "0 10px 24px rgba(11, 93, 107, 0.16)",
    navChildActiveBg: "#edf8f8",
    navChildActiveText: "#063e49",
    navChildActiveBorder: "#0B5D6B",
    searchBg: "rgba(249, 251, 251, 0.94)",
    tableHeaderBg: "#f0f7f7",
    tableHover: "#f7fbfb",
    tableBorder: "#d7e3e2",
    shimmerFrom: "#f6f9f9",
    shimmerMid: "#e4eeee",
    iconGlow: "rgba(11, 93, 107, 0.22)",
    accentGradient: "linear-gradient(135deg, #0B5D6B 0%, #188A75 58%, #A6722A 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(11,93,107,0.12) 0%, rgba(24,138,117,0.1) 58%, rgba(166,114,42,0.13) 100%)",
    floatShadow: "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(11,93,107,0.07)",
    cardHoverShadow: "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(11,93,107,0.08)",
  },
  hospital_navy_mint: {
    label: "Navy Steel + Brass",
    primary: hospitalNavy,
    accentScale: orange,
    secondary: "#2F7A6D",
    accent: "#B7791F",
    accentDeep: "#74470f",
    canvas: "#ffffff",
    content: "linear-gradient(135deg, #f8fbfd 0%, #eef5fb 54%, #fff8eb 100%)",
    panel: "#f3f7f9",
    surface: "#ffffff",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #e8f1f8 48%, #fff7e6 100%)",
    headerBg:
      "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(242,247,251,0.9) 58%, rgba(255,248,234,0.88) 100%)",
    inputBg: "#ffffff",
    border: "#d8e3ea",
    borderSubtle: "#e8eff4",
    textPrimary: "#101820",
    textSecondary: "#334455",
    textMuted: "#647484",
    textFaint: "#c4ced8",
    activeBg: "#d9e8f4",
    activeBgStrong: "#b6d1e7",
    activeBorder: "#1F4E79",
    activeText: "#173E61",
    navHoverBg: "rgba(31, 78, 121, 0.08)",
    navHoverText: "#173E61",
    navActiveBg: "linear-gradient(135deg, rgba(217,232,244,0.96) 0%, rgba(255,248,235,0.9) 100%)",
    navActiveText: "#173E61",
    navActiveShadow: "0 10px 24px rgba(31, 78, 121, 0.16)",
    navChildActiveBg: "#eef5fb",
    navChildActiveText: "#12314d",
    navChildActiveBorder: "#1F4E79",
    searchBg: "rgba(248, 251, 253, 0.94)",
    tableHeaderBg: "#eef5fb",
    tableHover: "#f7fbfd",
    tableBorder: "#d8e3ea",
    shimmerFrom: "#f6f9fb",
    shimmerMid: "#e1eaf1",
    iconGlow: "rgba(31, 78, 121, 0.22)",
    accentGradient: "linear-gradient(135deg, #1F4E79 0%, #2F7A6D 58%, #B7791F 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(31,78,121,0.12) 0%, rgba(47,122,109,0.1) 58%, rgba(183,121,31,0.13) 100%)",
    floatShadow: "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(31,78,121,0.07)",
    cardHoverShadow: "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(31,78,121,0.08)",
  },
  clean_blue_green: {
    label: "Boardroom Blue + Emerald",
    primary: cleanBlue,
    accentScale: teal,
    secondary: "#2F855A",
    accent: "#8A6F2A",
    accentDeep: "#5f4a16",
    canvas: "#ffffff",
    content: "linear-gradient(135deg, #f9fbff 0%, #edf4ff 54%, #f0fbf5 100%)",
    panel: "#f5f8fb",
    surface: "#ffffff",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #e9f1ff 48%, #edf9f2 100%)",
    headerBg:
      "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(241,246,255,0.9) 58%, rgba(240,251,245,0.88) 100%)",
    inputBg: "#ffffff",
    border: "#d9e2ee",
    borderSubtle: "#e9eef6",
    textPrimary: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    textFaint: "#cbd5e1",
    activeBg: "#dbe7ff",
    activeBgStrong: "#b8cffd",
    activeBorder: "#315C9B",
    activeText: "#284b80",
    navHoverBg: "rgba(49, 92, 155, 0.08)",
    navHoverText: "#284b80",
    navActiveBg: "linear-gradient(135deg, rgba(219,231,255,0.96) 0%, rgba(237,248,241,0.9) 100%)",
    navActiveText: "#284b80",
    navActiveShadow: "0 10px 24px rgba(49, 92, 155, 0.16)",
    navChildActiveBg: "#eef4ff",
    navChildActiveText: "#203d68",
    navChildActiveBorder: "#315C9B",
    searchBg: "rgba(247, 249, 252, 0.96)",
    tableHeaderBg: "#eef4ff",
    tableHover: "#f7f9fc",
    tableBorder: "#d9e2ee",
    shimmerFrom: "#f7f9fc",
    shimmerMid: "#e5edf7",
    iconGlow: "rgba(49, 92, 155, 0.22)",
    accentGradient: "linear-gradient(135deg, #315C9B 0%, #2F855A 58%, #8A6F2A 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(49,92,155,0.12) 0%, rgba(47,133,90,0.1) 58%, rgba(138,111,42,0.12) 100%)",
    floatShadow: "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(49,92,155,0.07)",
    cardHoverShadow: "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(49,92,155,0.08)",
  },
  surgical_graphite_aqua: {
    label: "Graphite + Indigo",
    primary: surgicalAqua,
    accentScale: violet,
    secondary: "#3A7D7E",
    accent: "#5B5F97",
    accentDeep: "#3e416c",
    canvas: "#ffffff",
    content: "linear-gradient(135deg, #f8fafb 0%, #edf3f6 52%, #f6f3ff 100%)",
    panel: "#f3f5f7",
    surface: "#ffffff",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #e8f0f4 48%, #f3f0ff 100%)",
    headerBg:
      "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(241,245,248,0.9) 58%, rgba(246,243,255,0.88) 100%)",
    inputBg: "#ffffff",
    border: "#dbe2e7",
    borderSubtle: "#e8edf1",
    textPrimary: "#12171B",
    textSecondary: "#36434A",
    textMuted: "#6B7280",
    textFaint: "#cbd5e1",
    activeBg: "#dde7ee",
    activeBgStrong: "#bccfdc",
    activeBorder: "#2F4858",
    activeText: "#263a47",
    navHoverBg: "rgba(47, 72, 88, 0.08)",
    navHoverText: "#263a47",
    navActiveBg: "linear-gradient(135deg, rgba(221,231,238,0.96) 0%, rgba(245,243,255,0.9) 100%)",
    navActiveText: "#263a47",
    navActiveShadow: "0 10px 24px rgba(47, 72, 88, 0.16)",
    navChildActiveBg: "#f1f5f8",
    navChildActiveText: "#1e2e38",
    navChildActiveBorder: "#2F4858",
    searchBg: "rgba(246, 247, 249, 0.96)",
    tableHeaderBg: "#f1f5f8",
    tableHover: "#f8fafc",
    tableBorder: "#dbe2e7",
    shimmerFrom: "#f6f7f9",
    shimmerMid: "#e6ecef",
    iconGlow: "rgba(47, 72, 88, 0.22)",
    accentGradient: "linear-gradient(135deg, #2F4858 0%, #3A7D7E 56%, #5B5F97 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(47,72,88,0.12) 0%, rgba(58,125,126,0.1) 56%, rgba(91,95,151,0.12) 100%)",
    floatShadow: "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(47,72,88,0.07)",
    cardHoverShadow: "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(47,72,88,0.08)",
  },
  public_health_green_blue: {
    label: "Public Health Deep Green",
    primary: publicHealthGreen,
    accentScale: warning,
    secondary: "#2C6E7F",
    accent: "#9A7A25",
    accentDeep: "#604914",
    canvas: "#ffffff",
    content: "linear-gradient(135deg, #f9fcfa 0%, #edf8f1 52%, #eef8fb 100%)",
    panel: "#f4f8f5",
    surface: "#ffffff",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #e8f5ed 48%, #eaf6fa 100%)",
    headerBg:
      "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(240,249,243,0.9) 58%, rgba(238,248,251,0.88) 100%)",
    inputBg: "#ffffff",
    border: "#d9e7dd",
    borderSubtle: "#e8f1eb",
    textPrimary: "#10201A",
    textSecondary: "#33443d",
    textMuted: "#66756F",
    textFaint: "#c8d2cd",
    activeBg: "#d9efe2",
    activeBgStrong: "#b6dfc9",
    activeBorder: "#2E6F54",
    activeText: "#245a43",
    navHoverBg: "rgba(46, 111, 84, 0.08)",
    navHoverText: "#245a43",
    navActiveBg: "linear-gradient(135deg, rgba(217,239,226,0.96) 0%, rgba(239,246,250,0.9) 100%)",
    navActiveText: "#245a43",
    navActiveShadow: "0 10px 24px rgba(46, 111, 84, 0.16)",
    navChildActiveBg: "#eef8f2",
    navChildActiveText: "#1d4836",
    navChildActiveBorder: "#2E6F54",
    searchBg: "rgba(247, 250, 248, 0.96)",
    tableHeaderBg: "#eef8f2",
    tableHover: "#f7faf8",
    tableBorder: "#d9e7dd",
    shimmerFrom: "#f7faf8",
    shimmerMid: "#e3eee7",
    iconGlow: "rgba(46, 111, 84, 0.22)",
    accentGradient: "linear-gradient(135deg, #2E6F54 0%, #2C6E7F 58%, #9A7A25 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(46,111,84,0.12) 0%, rgba(44,110,127,0.1) 58%, rgba(154,122,37,0.12) 100%)",
    floatShadow: "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(46,111,84,0.07)",
    cardHoverShadow: "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(46,111,84,0.08)",
  },
};

const activeScheme = COLOR_SCHEMES[ACTIVE_COLOR_SCHEME];
const primary = activeScheme.primary;
const selectedAccent = activeScheme.accentScale;

// ── Container Sizes ────────────────────────────────────────────

const CONTAINER_SIZES: Record<string, string> = {
  xxs: rem("200px"),
  xs: rem("300px"),
  sm: rem("400px"),
  md: rem("500px"),
  lg: rem("600px"),
  xl: rem("1400px"),
  xxl: rem("1600px"),
};

// ── Font stacks ────────────────────────────────────────────────

export const FONT_SCHEMES: Record<MedBrainsFontSchemeId, string> = {
  manrope_nunito:
    "'Manrope', 'Nunito Sans', 'Noto Sans', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  nunito_manrope:
    "'Nunito Sans', 'Manrope', 'Noto Sans', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  system_premium:
    "'Avenir Next', Avenir, 'Manrope', 'Nunito Sans', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  previous_ibm_plex:
    "'IBM Plex Sans', 'Noto Sans', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const FONT_SANS = FONT_SCHEMES[ACTIVE_FONT_SCHEME];

const FONT_DISPLAY = FONT_SANS;

// ── Theme ──────────────────────────────────────────────────────

export const theme = createTheme({
  primaryColor: "primary",
  colors: {
    primary,
    success,
    warning,
    danger,
    info,
    violet,
    orange,
    teal,
    slate,
    copper: selectedAccent,
  },

  fontFamily: FONT_SANS,
  fontSmoothing: true,

  fontSizes: {
    xs: rem("12px"),
    sm: rem("14px"),
    md: rem("16px"),
    lg: rem("18px"),
    xl: rem("20px"),
  },

  spacing: {
    "3xs": rem("4px"),
    "2xs": rem("8px"),
    xs: rem("10px"),
    sm: rem("12px"),
    md: rem("16px"),
    lg: rem("20px"),
    xl: rem("24px"),
    "2xl": rem("28px"),
    "3xl": rem("32px"),
  },

  defaultRadius: "md",

  radius: {
    xs: rem("4px"),
    sm: rem("6px"),
    md: rem("8px"),
    lg: rem("12px"),
    xl: rem("16px"),
  },

  headings: {
    fontFamily: FONT_SANS,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: rem("28px"), lineHeight: "1.2", fontWeight: "600" },
      h2: { fontSize: rem("22px"), lineHeight: "1.25" },
      h3: { fontSize: rem("18px"), lineHeight: "1.3" },
      h4: { fontSize: rem("15px"), lineHeight: "1.35", fontWeight: "500" },
    },
  },

  // Dual-layer shadows (design system spec)
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 8px rgba(0, 0, 0, 0.04)",
    md: "0 2px 4px rgba(0, 0, 0, 0.03), 0 8px 20px rgba(0, 0, 0, 0.06)",
    lg: "0 4px 8px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.08)",
    xl: "0 8px 16px rgba(0, 0, 0, 0.04), 0 20px 48px rgba(0, 0, 0, 0.1)",
  },

  components: {
    Container: Container.extend({
      vars: (_, { size, fluid }) => ({
        root: {
          "--container-size": fluid
            ? "100%"
            : size !== undefined && size in CONTAINER_SIZES
              ? CONTAINER_SIZES[size]
              : rem(size),
        },
      }),
    }),

    Paper: Paper.extend({
      defaultProps: {
        p: "md",
        shadow: "sm",
        radius: "md",
        withBorder: false,
      },
    }),

    Card: Card.extend({
      defaultProps: {
        p: "md",
        shadow: "sm",
        radius: "md",
        withBorder: false,
      },
    }),

    Select: Select.extend({
      defaultProps: {
        checkIconPosition: "right",
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    Table: {
      defaultProps: {
        striped: false,
        withTableBorder: false,
        withColumnBorders: false,
        highlightOnHover: true,
        verticalSpacing: 10,
        horizontalSpacing: "sm",
        fz: "sm",
      },
    },

    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.25, blur: 8 },
        radius: "lg",
        shadow: "xl",
        transitionProps: { duration: 200, transition: "fade" },
      },
    },

    Badge: {
      defaultProps: {
        variant: "light",
        radius: "xl",
        size: "md",
        fw: 600,
      },
    },

    TextInput: {
      defaultProps: {
        radius: "md",
        size: "sm",
        variant: "default",
      },
    },

    PasswordInput: {
      defaultProps: {
        radius: "md",
        size: "sm",
        variant: "default",
      },
    },

    Textarea: {
      defaultProps: {
        radius: "md",
        size: "sm",
        variant: "default",
      },
    },

    NumberInput: {
      defaultProps: {
        radius: "md",
        size: "sm",
        variant: "default",
      },
    },

    Button: {
      defaultProps: {
        radius: "md",
        fw: 600,
      },
    },

    NavLink: {
      defaultProps: {
        variant: "subtle",
      },
    },

    Tabs: {
      defaultProps: {
        variant: "pills",
        radius: "md",
        keepMounted: true,
      },
    },

    ActionIcon: {
      defaultProps: {
        variant: "default",
        radius: "md",
      },
    },

    ThemeIcon: {
      defaultProps: {
        variant: "light",
        radius: "lg",
      },
    },

    Divider: {
      defaultProps: {
        color: "slate.1",
      },
    },

    Loader: Loader.extend({
      defaultProps: {
        loaders: { ...Loader.defaultLoaders, ecg: EcgLoader },
        type: "ecg",
      },
    }),

    Skeleton: {
      defaultProps: {
        radius: "lg",
      },
    },

    Tooltip: {
      defaultProps: {
        withArrow: true,
        radius: "md",
        fz: "xs",
        transitionProps: { duration: 150, transition: "fade" },
      },
    },

    Drawer: {
      defaultProps: {
        shadow: "xl",
        transitionProps: { duration: 300 },
      },
    },

    Menu: {
      defaultProps: {
        radius: "lg",
        shadow: "md",
        transitionProps: { duration: 150, transition: "scale-y" },
      },
    },

    Popover: {
      defaultProps: {
        radius: "lg",
        shadow: "md",
      },
    },

    Alert: {
      defaultProps: {
        radius: "lg",
        variant: "light",
      },
    },

    Accordion: {
      defaultProps: {
        radius: "lg",
      },
    },
  },

  other: {
    style: "soft-modern",
    fontDisplay: FONT_DISPLAY,
  },
});

// ═══════════════════════════════════════════════════════════════════
// ── CSS Variables Resolver: Forest + Copper Semantic Tokens
// ═══════════════════════════════════════════════════════════════════

export const cssVariableResolver: CSSVariablesResolver = (t) => {
  const p = t.colors.primary ?? primary;
  const s = t.colors.success ?? success;
  const w = t.colors.warning ?? warning;
  const d = t.colors.danger ?? danger;
  const i = t.colors.info ?? info;
  const cop = t.colors.copper ?? selectedAccent;
  const scheme = activeScheme;

  return {
    variables: {
      "--mb-radius": t.radius?.xl ?? rem("16px"),
      // ── Vibrant clinical semantic tokens ──
      "--fc-brand": p[5],
      "--fc-brand-hover": p[6],
      "--fc-brand-deep": p[7],
      "--fc-ink": scheme.textPrimary,
      "--fc-sub": scheme.textSecondary,
      "--fc-muted": scheme.textMuted,
      "--fc-faint": scheme.textFaint,
      "--fc-rule": scheme.border,
      "--fc-rule-soft": scheme.borderSubtle,
      "--fc-canvas": scheme.canvas,
      "--fc-panel": scheme.panel,
      "--fc-surface": scheme.surface,
      "--fc-tint": p[1],
      "--fc-tint-2": p[2],
      "--fc-outline": p[2],
      "--fc-copper": scheme.accent,
      "--fc-copper-tint": cop[1],
      "--fc-copper-deep": scheme.accentDeep,
      "--mb-accent-gradient": scheme.accentGradient,
      "--mb-accent-gradient-soft": scheme.accentGradientSoft,
      // ── Emergency code layer (NOT themeable — safety-critical) ──
      "--code-blue": "#1E63B8",
      "--code-red": "#C8102E",
      "--code-pink": "#E24C94",
      "--code-black": "#0a0a0a",
      "--code-yellow": "#E6B422",
      "--code-orange": "#E86A1F",
      // Font stacks
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
      "--font-mono": "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    },
    light: {
      // ── Surfaces (white-first institutional) ──
      "--mantine-color-body": scheme.canvas,
      "--mb-bg-content": scheme.content,
      "--mb-sidebar-bg": scheme.sidebarBg,
      "--mb-header-bg": scheme.headerBg,
      "--mb-card-bg": scheme.surface,
      "--mb-input-bg": scheme.inputBg,

      // ── Borders (cool hairline) ──
      "--mb-border": scheme.border,
      "--mb-border-subtle": scheme.borderSubtle,

      // ── Text hierarchy (graphite ink, never #000) ──
      "--mb-text-primary": scheme.textPrimary,
      "--mb-text-secondary": scheme.textSecondary,
      "--mb-text-muted": scheme.textMuted,
      "--mb-text-faint": scheme.textFaint,

      // ── Interactive ──
      "--mb-selection-bg": p[1],
      "--mb-focus-ring": p[5],
      "--mb-link": p[5],
      "--mb-link-hover": p[6],
      "--mb-active-bg": scheme.activeBg,
      "--mb-active-bg-strong": scheme.activeBgStrong,
      "--mb-active-border": scheme.activeBorder,
      "--mb-active-text": scheme.activeText,
      "--mb-icon-glow": scheme.iconGlow,
      "--mb-nav-hover-bg": scheme.navHoverBg,
      "--mb-nav-hover-text": scheme.navHoverText,
      "--mb-nav-active-bg": scheme.navActiveBg,
      "--mb-nav-active-text": scheme.navActiveText,
      "--mb-nav-active-shadow": scheme.navActiveShadow,
      "--mb-nav-child-active-bg": scheme.navChildActiveBg,
      "--mb-nav-child-active-text": scheme.navChildActiveText,
      "--mb-nav-child-active-border": scheme.navChildActiveBorder,
      "--mb-search-bg": scheme.searchBg,

      // ── Semantic status colors (bg / text pairs) ──
      "--mb-success-bg": s[0],
      "--mb-success-text": s[7],
      "--mb-success-accent": s[5],
      "--mb-warning-bg": w[0],
      "--mb-warning-text": w[7],
      "--mb-warning-accent": w[5],
      "--mb-danger-bg": d[0],
      "--mb-danger-text": d[7],
      "--mb-danger-accent": d[5],
      "--mb-info-bg": i[0],
      "--mb-info-text": i[7],
      "--mb-info-accent": i[5],

      // ── Table ──
      "--mb-table-header-bg": scheme.tableHeaderBg,
      "--mb-table-hover": scheme.tableHover,
      "--mb-table-border": scheme.tableBorder,

      // ── Shimmer ──
      "--mb-shimmer-from": scheme.shimmerFrom,
      "--mb-shimmer-mid": scheme.shimmerMid,

      // ── Shadows ──
      "--mb-float-shadow": scheme.floatShadow,
      "--mb-card-hover-shadow": scheme.cardHoverShadow,

      // ── Clinical status (high-visibility for patient safety) ──
      "--mb-critical-bg": "#fff1f2",
      "--mb-critical-text": "#be123c",
      "--mb-critical-border": "#fecdd3",
      "--mb-abnormal-bg": "#fffbeb",
      "--mb-abnormal-text": "#b45309",
      "--mb-abnormal-border": "#fde68a",
      "--mb-normal-bg": "#ecfdf5",
      "--mb-normal-text": "#047857",
      "--mb-normal-border": "#a7f3d0",
    },
    dark: {
      // ── Dark theme (forest-black) ──
      "--mantine-color-body": "#0a0f0c",
      "--mb-bg-content": "#101613",
      "--mb-sidebar-bg": "#101613",
      "--mb-header-bg": "rgba(16, 22, 19, 0.9)",
      "--mb-card-bg": "#141c18",
      "--mb-input-bg": "#141c18",

      "--mb-border": "#1e2823",
      "--mb-border-subtle": "#172019",

      "--mb-text-primary": "#f3f7f5",
      "--mb-text-secondary": "#9aa8a1",
      "--mb-text-muted": "#6b7a72",
      "--mb-text-faint": "#3a4540",

      "--mb-selection-bg": p[8],
      "--mb-focus-ring": p[4],
      "--mb-link": p[3],
      "--mb-link-hover": p[2],
      "--mb-active-bg": "#134e4a",
      "--mb-active-bg-strong": "#115e59",
      "--mb-active-border": "#2dd4bf",
      "--mb-active-text": "#99f6e4",
      "--mb-icon-glow": "rgba(45, 212, 191, 0.32)",
      "--mb-nav-hover-bg": "rgba(45, 212, 191, 0.1)",
      "--mb-nav-hover-text": "#99f6e4",
      "--mb-nav-active-bg":
        "linear-gradient(135deg, rgba(19,78,74,0.98) 0%, rgba(12,74,110,0.9) 62%, rgba(120,53,15,0.72) 100%)",
      "--mb-nav-active-text": "#ccfbf1",
      "--mb-nav-active-shadow": "0 12px 30px rgba(20,184,166,0.24)",
      "--mb-nav-child-active-bg": "#0c4a6e",
      "--mb-nav-child-active-text": "#bae6fd",
      "--mb-nav-child-active-border": "#38bdf8",
      "--mb-search-bg": "rgba(20, 28, 24, 0.9)",

      "--mb-success-bg": "#052e16",
      "--mb-success-text": s[2],
      "--mb-success-accent": s[4],
      "--mb-warning-bg": "#422006",
      "--mb-warning-text": w[2],
      "--mb-warning-accent": w[4],
      "--mb-danger-bg": "#450a0a",
      "--mb-danger-text": d[2],
      "--mb-danger-accent": d[4],
      "--mb-info-bg": "#0c4a6e",
      "--mb-info-text": i[2],
      "--mb-info-accent": i[4],

      "--mb-table-header-bg": "#141c18",
      "--mb-table-hover": "#1e2823",
      "--mb-table-border": "#1e2823",

      "--mb-shimmer-from": "#1e2823",
      "--mb-shimmer-mid": "#172019",

      "--mb-float-shadow": "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.25)",
      "--mb-card-hover-shadow": "0 8px 22px rgba(0,0,0,0.32), 0 18px 42px rgba(20,184,166,0.14)",

      "--mb-critical-bg": "#450a0a",
      "--mb-critical-text": "#fecdd3",
      "--mb-critical-border": "#9f1239",
      "--mb-abnormal-bg": "#422006",
      "--mb-abnormal-text": "#fde68a",
      "--mb-abnormal-border": "#92400e",
      "--mb-normal-bg": "#052e16",
      "--mb-normal-text": "#a7f3d0",
      "--mb-normal-border": "#065f46",
    },
  };
};
