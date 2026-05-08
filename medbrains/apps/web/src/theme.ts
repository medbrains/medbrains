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

// Brand — Clinical teal-green (professional, brighter, responsive)
const primary: MantineColorsTuple = [
  "#ecfdf5", // 0  ghost
  "#d1fae5", // 1  dimmed / selection / tint
  "#99f6e4", // 2  subtle / tint-2
  "#5eead4", // 3  medium
  "#2dd4bf", // 4  strong
  "#0F766E", // 5  accent      <- BRAND (clinical teal)
  "#0d6b63", // 6  hover
  "#115e59", // 7  pressed / deep
  "#134e4a", // 8  deep
  "#042f2e", // 9  abyss
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

const FONT_SANS =
  "'IBM Plex Sans', 'Noto Sans', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
    copper,
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
  const cop = t.colors.copper ?? copper;

  return {
    variables: {
      "--mb-radius": t.radius?.xl ?? rem("16px"),
      // ── Vibrant clinical semantic tokens ──
      "--fc-brand": p[5],
      "--fc-brand-hover": p[6],
      "--fc-brand-deep": p[7],
      "--fc-ink": "#0F1412",
      "--fc-sub": "#3e4a44",
      "--fc-muted": "#8a938f",
      "--fc-faint": "#c7ccc9",
      "--fc-rule": "#e7ebe8",
      "--fc-rule-soft": "#eef2f0",
      "--fc-canvas": "#ffffff",
      "--fc-panel": "#f7f8f6",
      "--fc-surface": "#ffffff",
      "--fc-tint": p[1],
      "--fc-tint-2": p[2],
      "--fc-outline": p[2],
      "--fc-copper": cop[5],
      "--fc-copper-tint": cop[1],
      "--fc-copper-deep": cop[7],
      "--mb-accent-gradient": "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 48%, #f59e0b 100%)",
      "--mb-accent-gradient-soft":
        "linear-gradient(135deg, rgba(20,184,166,0.14) 0%, rgba(14,165,233,0.12) 50%, rgba(245,158,11,0.16) 100%)",
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
      "--mantine-color-body": "#ffffff",
      "--mb-bg-content": "#f4fbf9",
      "--mb-sidebar-bg": "linear-gradient(180deg, #ffffff 0%, #f0fdfa 52%, #fff7ed 100%)",
      "--mb-header-bg": "rgba(255, 255, 255, 0.9)",
      "--mb-card-bg": "#ffffff",
      "--mb-input-bg": "#ffffff",

      // ── Borders (cool hairline) ──
      "--mb-border": "#dcebe8",
      "--mb-border-subtle": "#eaf5f2",

      // ── Text hierarchy (graphite ink, never #000) ──
      "--mb-text-primary": "#0F1412",
      "--mb-text-secondary": "#3e4a44",
      "--mb-text-muted": "#8a938f",
      "--mb-text-faint": "#c7ccc9",

      // ── Interactive ──
      "--mb-selection-bg": p[1],
      "--mb-focus-ring": p[5],
      "--mb-link": p[5],
      "--mb-link-hover": p[6],
      "--mb-active-bg": "#ccfbf1",
      "--mb-active-bg-strong": "#99f6e4",
      "--mb-active-border": "#14b8a6",
      "--mb-active-text": "#0f766e",
      "--mb-icon-glow": "rgba(20, 184, 166, 0.28)",
      "--mb-nav-hover-bg": "rgba(20, 184, 166, 0.08)",
      "--mb-nav-hover-text": "#0f766e",
      "--mb-nav-active-bg":
        "linear-gradient(135deg, rgba(204,251,241,0.95) 0%, rgba(224,242,254,0.96) 58%, rgba(255,237,213,0.92) 100%)",
      "--mb-nav-active-text": "#0f766e",
      "--mb-nav-active-shadow": "0 10px 26px rgba(20, 184, 166, 0.2)",
      "--mb-nav-child-active-bg": "#e0f2fe",
      "--mb-nav-child-active-text": "#0369a1",
      "--mb-nav-child-active-border": "#0ea5e9",
      "--mb-search-bg": "rgba(240, 253, 250, 0.9)",

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
      "--mb-table-header-bg": "#ecfeff",
      "--mb-table-hover": "#f0fdfa",
      "--mb-table-border": "#dcebe8",

      // ── Shimmer ──
      "--mb-shimmer-from": "#f7f8f6",
      "--mb-shimmer-mid": "#e7ebe8",

      // ── Shadows ──
      "--mb-float-shadow": "0 1px 3px rgba(15,23,42,0.05), 0 12px 28px rgba(20,184,166,0.08)",
      "--mb-card-hover-shadow": "0 8px 22px rgba(15,23,42,0.08), 0 18px 42px rgba(20,184,166,0.08)",

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
