import {
  Autocomplete,
  Card,
  Combobox,
  Container,
  type CSSVariablesResolver,
  createTheme,
  Loader,
  type MantineColorsTuple,
  MultiSelect,
  Paper,
  rem,
  Select,
  TagsInput,
} from "@mantine/core";
import { DateInput, DatePickerInput, DateTimePicker } from "@mantine/dates";
import { EcgLoader } from "./components/EcgLoader";

// ═══════════════════════════════════════════════════════════════════
// ── MedBrains Design System: Vibrant Clinical
// ═══════════════════════════════════════════════════════════════════
//
// Brand: clinical teal-green on a professional dark clinical base
// Accent: copper/gold for review-worthy moments
// Canvas: dark, glare-controlled workspace
// Ink: white-first text hierarchy tuned for WCAG AAA target contrast
//
// Pattern: Material-style semantic roles + Airbnb-style reusable components
// Fonts: Inter (enterprise healthcare UI), JetBrains Mono (clinical IDs/code)
// ═══════════════════════════════════════════════════════════════════

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

interface MedBrainsDesignTokens {
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
  tableText: string;
  tableTextMuted: string;
  tableHeaderText: string;
  tableSelectedBg: string;
  shimmerFrom: string;
  shimmerMid: string;
  iconGlow: string;
  accentGradient: string;
  accentGradientSoft: string;
  floatShadow: string;
  cardHoverShadow: string;
}

interface SemanticStatusTokens {
  bg: string;
  text: string;
  border: string;
  accent: string;
}

const successStatus: SemanticStatusTokens = {
  bg: "#06351E",
  text: "#E8FFF1",
  border: "#22C55E",
  accent: "#4ADE80",
};

const warningStatus: SemanticStatusTokens = {
  bg: "#3A2A00",
  text: "#FFF8D6",
  border: "#EAB308",
  accent: "#FACC15",
};

const dangerStatus: SemanticStatusTokens = {
  bg: "#3D0A16",
  text: "#FFE8EE",
  border: "#F43F5E",
  accent: "#FB7185",
};

const infoStatus: SemanticStatusTokens = {
  bg: "#082F49",
  text: "#E5F7FF",
  border: "#0EA5E9",
  accent: "#38BDF8",
};

const neutralStatus: SemanticStatusTokens = {
  bg: "#1E293B",
  text: "#F1F5F9",
  border: "#94A3B8",
  accent: "#CBD5E1",
};

const orangeStatus: SemanticStatusTokens = {
  bg: "#3B1B05",
  text: "#FFF0DF",
  border: "#F97316",
  accent: "#FB923C",
};

const MEDBRAINS_DESIGN_TOKENS: MedBrainsDesignTokens = {
  label: "MedBrains Dark Clinical Operations",
  primary: clinicalTeal,
  accentScale: copper,
  secondary: "#64D2C8",
  accent: "#F6D58A",
  accentDeep: "#F1BE5C",
  canvas: "#071113",
  content: "linear-gradient(135deg, #071113 0%, #0a191d 54%, #151407 100%)",
  panel: "#0B171A",
  surface: "#0F1D21",
  sidebarBg: "linear-gradient(180deg, #071113 0%, #0A1A1D 48%, #171408 100%)",
  headerBg:
    "linear-gradient(90deg, rgba(7,17,19,0.94) 0%, rgba(10,25,29,0.9) 58%, rgba(21,20,7,0.88) 100%)",
  inputBg: "#0A1518",
  border: "#315057",
  borderSubtle: "#1D343A",
  textPrimary: "#F7FEFF",
  textSecondary: "#D8EAEE",
  textMuted: "#B5CDD2",
  textFaint: "#789198",
  activeBg: "#12343A",
  activeBgStrong: "#18515B",
  activeBorder: "#7ED7D7",
  activeText: "#E6FCFF",
  navHoverBg: "rgba(126, 215, 215, 0.12)",
  navHoverText: "#F7FEFF",
  navActiveBg:
    "linear-gradient(135deg, rgba(18,52,58,0.98) 0%, rgba(16,76,84,0.9) 58%, rgba(82,63,22,0.76) 100%)",
  navActiveText: "#F7FEFF",
  navActiveShadow: "0 16px 34px rgba(0, 0, 0, 0.34), 0 8px 24px rgba(126, 215, 215, 0.16)",
  navChildActiveBg: "#102A30",
  navChildActiveText: "#E6FCFF",
  navChildActiveBorder: "#7ED7D7",
  searchBg: "rgba(10, 21, 24, 0.96)",
  tableHeaderBg: "#10262B",
  tableHover: "#142C31",
  tableBorder: "#2E4A51",
  tableText: "#F7FEFF",
  tableTextMuted: "#B5CDD2",
  tableHeaderText: "#E6FCFF",
  tableSelectedBg: "#183940",
  shimmerFrom: "#102329",
  shimmerMid: "#1A343A",
  iconGlow: "rgba(126, 215, 215, 0.26)",
  accentGradient: "linear-gradient(135deg, #7ED7D7 0%, #64D2C8 54%, #F6D58A 100%)",
  accentGradientSoft:
    "linear-gradient(135deg, rgba(126,215,215,0.18) 0%, rgba(100,210,200,0.12) 54%, rgba(246,213,138,0.16) 100%)",
  floatShadow: "0 1px 3px rgba(0,0,0,0.28), 0 18px 42px rgba(0,0,0,0.26)",
  cardHoverShadow: "0 10px 28px rgba(0,0,0,0.34), 0 24px 54px rgba(126,215,215,0.12)",
};

const activeScheme = MEDBRAINS_DESIGN_TOKENS;
const primary = activeScheme.primary;
const selectedAccent = MEDBRAINS_DESIGN_TOKENS.accentScale;

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

export const MEDBRAINS_FONT_STACK =
  "'Inter', 'Noto Sans', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const FONT_SANS = MEDBRAINS_FONT_STACK;
const FONT_DISPLAY = MEDBRAINS_FONT_STACK;
const MODAL_DROPDOWN_PROPS = {
  middlewares: { flip: true, shift: true, size: true },
  position: "bottom-start" as const,
  shadow: "lg",
  withinPortal: true,
  zIndex: 3000,
  styles: {
    dropdown: {
      background: "var(--mb-panel-bg)",
      color: "var(--mb-text-primary)",
      border: "1px solid var(--mb-border)",
      boxShadow:
        "0 14px 36px rgba(0, 0, 0, 0.46), 0 3px 8px rgba(0, 0, 0, 0.3)",
    },
  },
};
const MODAL_DROPDOWN_MAX_HEIGHT = 280;

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
        comboboxProps: MODAL_DROPDOWN_PROPS,
        maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    MultiSelect: MultiSelect.extend({
      defaultProps: {
        checkIconPosition: "right",
        comboboxProps: MODAL_DROPDOWN_PROPS,
        maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    TagsInput: TagsInput.extend({
      defaultProps: {
        comboboxProps: MODAL_DROPDOWN_PROPS,
        maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    Autocomplete: Autocomplete.extend({
      defaultProps: {
        comboboxProps: MODAL_DROPDOWN_PROPS,
        maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    Combobox: Combobox.extend({
      defaultProps: {
        middlewares: { flip: true, shift: true, size: true },
        shadow: "lg",
        withinPortal: true,
        zIndex: 3000,
      },
    }),

    DateInput: DateInput.extend({
      defaultProps: {
        popoverProps: MODAL_DROPDOWN_PROPS,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    DatePickerInput: DatePickerInput.extend({
      defaultProps: {
        popoverProps: MODAL_DROPDOWN_PROPS,
        radius: "md",
        size: "sm",
        variant: "default",
      },
    }),

    DateTimePicker: DateTimePicker.extend({
      defaultProps: {
        popoverProps: MODAL_DROPDOWN_PROPS,
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

    Text: {
      defaultProps: {
        c: "var(--mb-text-body)",
      },
    },

    Title: {
      defaultProps: {
        c: "var(--mb-text-heading)",
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
        color: "var(--mb-border-subtle)",
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
      styles: {
        dropdown: {
          background: "var(--mb-panel-bg)",
          color: "var(--mb-text-primary)",
          border: "1px solid var(--mb-border)",
          boxShadow:
            "0 12px 32px rgba(0, 0, 0, 0.42), 0 2px 6px rgba(0, 0, 0, 0.28)",
        },
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
  const cop = t.colors.copper ?? selectedAccent;
  const scheme = activeScheme;
  const sharedPalette = {
    // ── Surfaces ──
    "--mantine-color-body": scheme.canvas,
    "--mantine-color-text": scheme.textPrimary,
    "--mantine-color-dimmed": scheme.textMuted,
    "--mb-bg-content": scheme.content,
    "--mb-sidebar-bg": scheme.sidebarBg,
    "--mb-header-bg": scheme.headerBg,
    "--mb-card-bg": scheme.surface,
    "--mb-panel-bg": scheme.panel,
    "--mb-input-bg": scheme.inputBg,
    "--mb-overlay-bg": "rgba(3, 8, 10, 0.72)",

    // ── Borders ──
    "--mb-border": scheme.border,
    "--mb-border-subtle": scheme.borderSubtle,

    // ── Text hierarchy ──
    "--mb-text-heading": scheme.textPrimary,
    "--mb-text-body": scheme.textPrimary,
    "--mb-text-primary": scheme.textPrimary,
    "--mb-text-secondary": scheme.textSecondary,
    "--mb-text-subtle": scheme.textSecondary,
    "--mb-text-muted": scheme.textMuted,
    "--mb-text-caption": scheme.textMuted,
    "--mb-text-faint": scheme.textFaint,
    "--mb-text-disabled": "#5D737A",

    // ── Typography rhythm ──
    "--mb-letter-spacing": "0",
    "--mb-line-height-title": "1.1",
    "--mb-line-height-ui": "1.25",
    "--mb-line-height-body": "1.45",
    "--mb-line-height-table": "1.32",
    "--mb-line-height-caption": "1.25",
    "--mb-font-weight-heading": "650",
    "--mb-font-weight-title": "650",
    "--mb-font-weight-subtitle": "520",
    "--mb-font-weight-body": "400",
    "--mb-font-weight-label": "560",
    "--mb-font-weight-table-header": "620",
    "--mb-font-weight-table-body": "420",
    "--mb-font-weight-patient": "620",
    "--mb-font-weight-indicator": "620",
    "--mb-font-weight-action": "620",

    // ── Interactive ──
    "--mb-selection-bg": "#24484F",
    "--mb-focus-ring": scheme.activeBorder,
    "--mb-link": "#BAF4F4",
    "--mb-link-hover": "#F6D58A",
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

    // ── Status and tags ──
    "--mb-success-bg": successStatus.bg,
    "--mb-success-text": successStatus.text,
    "--mb-success-border": successStatus.border,
    "--mb-success-accent": successStatus.accent,
    "--mb-warning-bg": warningStatus.bg,
    "--mb-warning-text": warningStatus.text,
    "--mb-warning-border": warningStatus.border,
    "--mb-warning-accent": warningStatus.accent,
    "--mb-danger-bg": dangerStatus.bg,
    "--mb-danger-text": dangerStatus.text,
    "--mb-danger-border": dangerStatus.border,
    "--mb-danger-accent": dangerStatus.accent,
    "--mb-info-bg": infoStatus.bg,
    "--mb-info-text": infoStatus.text,
    "--mb-info-border": infoStatus.border,
    "--mb-info-accent": infoStatus.accent,
    "--mb-neutral-bg": neutralStatus.bg,
    "--mb-neutral-text": neutralStatus.text,
    "--mb-neutral-border": neutralStatus.border,
    "--mb-neutral-accent": neutralStatus.accent,
    "--mb-orange-bg": orangeStatus.bg,
    "--mb-orange-text": orangeStatus.text,
    "--mb-orange-border": orangeStatus.border,
    "--mb-orange-accent": orangeStatus.accent,

    // ── Indicators are separate from generic theme colors ──
    "--mb-indicator-primary": "#2DD4BF",
    "--mb-indicator-teal": "#14B8A6",
    "--mb-indicator-success": "#22C55E",
    "--mb-indicator-green": "#22C55E",
    "--mb-indicator-warning": "#FACC15",
    "--mb-indicator-yellow": "#FACC15",
    "--mb-indicator-orange": "#FB923C",
    "--mb-indicator-danger": "#F43F5E",
    "--mb-indicator-red": "#F43F5E",
    "--mb-indicator-info": "#38BDF8",
    "--mb-indicator-blue": "#38BDF8",
    "--mb-indicator-violet": "#A78BFA",
    "--mb-indicator-purple": "#A78BFA",
    "--mb-indicator-slate": "#CBD5E1",
    "--mb-indicator-gray": "#CBD5E1",
    "--mb-indicator-neutral": "#CBD5E1",

    // ── Patient identity chips ──
    "--mb-gender-male-bg": "#0B3B6F",
    "--mb-gender-male-text": "#E8F6FF",
    "--mb-gender-male-border": "#38BDF8",
    "--mb-gender-female-bg": "#65112B",
    "--mb-gender-female-text": "#FFE8F1",
    "--mb-gender-female-border": "#FB7185",
    "--mb-gender-other-bg": "#39206B",
    "--mb-gender-other-text": "#F2EAFE",
    "--mb-gender-other-border": "#A78BFA",
    "--mb-gender-unknown-bg": "#3A2A00",
    "--mb-gender-unknown-text": "#FFF8D6",
    "--mb-gender-unknown-border": "#FACC15",

    // ── Component accent gradients by semantic meaning ──
    "--mb-accent-primary": "linear-gradient(135deg, #2DD4BF 0%, #7ED7D7 100%)",
    "--mb-accent-success": "linear-gradient(135deg, #22C55E 0%, #86EFAC 100%)",
    "--mb-accent-warning": "linear-gradient(135deg, #FACC15 0%, #FDE68A 100%)",
    "--mb-accent-danger": "linear-gradient(135deg, #F43F5E 0%, #FDA4AF 100%)",
    "--mb-accent-info": "linear-gradient(135deg, #38BDF8 0%, #BAE6FD 100%)",
    "--mb-accent-orange": "linear-gradient(135deg, #FB923C 0%, #FDBA74 100%)",
    "--mb-accent-violet": "linear-gradient(135deg, #8B5CF6 0%, #C4B5FD 100%)",
    "--mb-accent-neutral": "linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)",

    // ── Table ──
    "--mb-table-bg": scheme.surface,
    "--mb-table-header-bg": scheme.tableHeaderBg,
    "--mb-table-header-text": scheme.tableHeaderText,
    "--mb-table-text": scheme.tableText,
    "--mb-table-text-muted": scheme.tableTextMuted,
    "--mb-table-hover": scheme.tableHover,
    "--mb-table-selected-bg": scheme.tableSelectedBg,
    "--mb-table-border": scheme.tableBorder,

    // ── Shimmer and shadows ──
    "--mb-shimmer-from": scheme.shimmerFrom,
    "--mb-shimmer-mid": scheme.shimmerMid,
    "--mb-float-shadow": scheme.floatShadow,
    "--mb-shadow-soft": scheme.floatShadow,
    "--mb-card-hover-shadow": scheme.cardHoverShadow,

    // ── Clinical status (high-visibility for patient safety) ──
    "--mb-critical-bg": dangerStatus.bg,
    "--mb-critical-text": dangerStatus.text,
    "--mb-critical-border": dangerStatus.border,
    "--mb-abnormal-bg": warningStatus.bg,
    "--mb-abnormal-text": warningStatus.text,
    "--mb-abnormal-border": warningStatus.border,
    "--mb-normal-bg": successStatus.bg,
    "--mb-normal-text": successStatus.text,
    "--mb-normal-border": successStatus.border,
  };

  return {
    variables: {
      "--mb-radius": t.radius?.xl ?? rem("16px"),
      "--mb-page-header-bg":
        "linear-gradient(135deg, rgba(15, 29, 33, 0.96), rgba(10, 21, 24, 0.9)), var(--mb-accent-gradient-soft)",
      "--mb-page-header-padding-y": rem("4px"),
      "--mb-page-header-padding-x": rem("10px"),
      "--mb-page-header-icon-size": rem("24px"),
      "--mb-table-toolbar-bg": scheme.surface,
      "--mb-component-underline": "var(--mb-selected-edge)",
      "--mb-action-surface-bg": scheme.surface,
      "--mb-action-surface-hover-bg": scheme.tableHover,
      "--mb-action-surface-border": scheme.border,
      "--mb-action-surface-text": scheme.textPrimary,
      "--mb-chip-bg": neutralStatus.bg,
      "--mb-chip-text": neutralStatus.text,
      "--mb-chip-border": neutralStatus.border,
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
      "--mb-selected-edge": scheme.accentGradient,
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
      "--fc-font-display": FONT_DISPLAY,
      "--fc-font-sans": FONT_SANS,
      "--fc-font-mono": "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    },
    light: sharedPalette,
    dark: sharedPalette,
  };
};
