/**
 * MedBrains Design System — Mantine integration + CSS variable resolver
 *
 * Tier 3 of the token system. Consumes primitives (`primitives.ts`) and
 * semantic maps (`semantic.ts`) and produces:
 *  1. `createMedBrainsTheme(opts)` — Mantine theme factory
 *  2. `cssVariableResolver`        — emits dual-mode CSS variables (`--mb-*` / `--fc-*`)
 *
 * Mode policy:
 *  - Both schemes are Material-3 roles on brand blue #0F62FE, generated from
 *    the Figma library spec (`colors.generated.ts`).
 *  - Both share semantic var names; only the values differ. Components
 *    NEVER branch on `data-mantine-color-scheme` themselves — vars do it.
 *
 * Loader injection:
 *  The Mantine `Loader` component default-loader is wired via
 *  `opts.loaders.ecg` so this package stays free of web-specific component
 *  imports (e.g. EcgLoader lives in apps/web). Pass it in when the consumer
 *  app wants the branded ECG loader.
 */

import {
  Autocomplete,
  Card,
  Combobox,
  Container,
  type CSSVariablesResolver,
  createTheme,
  defaultVariantColorsResolver,
  Loader,
  type MantineLoaderComponent,
  type MantineThemeOverride,
  MultiSelect,
  Paper,
  rem,
  Select,
  TagsInput,
} from "@mantine/core";
import { DateInput, DatePickerInput, DateTimePicker } from "@mantine/dates";
import { ramps, roleCssVars, roles } from "./colors.generated";
import {
  ANATOMY_PALETTE,
  amberTuple,
  blueTuple,
  darkTuple,
  duration,
  easing,
  emergencyCodes,
  fontFamily,
  fontSize,
  fontWeight,
  greenTuple,
  letterSpacing,
  lineHeight,
  neutralTuple,
  ochreTuple,
  purpleTuple,
  radius,
  redTuple,
  slateTuple,
  space,
  tealTuple,
  zIndex,
} from "./primitives";
import { darkScheme, lightScheme, type SchemeName, sharedReferences } from "./semantic";

export type { SchemeName, SemanticScheme, StatusScale } from "./semantic";
export { darkScheme, lightScheme, schemes } from "./semantic";

/**
 * Mantine colour name → M3 role family [fill, onFill, container, onContainer, text].
 * `text` colours outline/subtle/text variants: blue and purple fills are the exact
 * brand colours in both schemes, so their small-text use needs the readable tint.
 */
type RoleKey = keyof (typeof roles)["light"];
type Family = readonly [RoleKey, RoleKey, RoleKey, RoleKey, RoleKey];
const BLUE: Family = ["primary", "onPrimary", "statePrimary12", "primaryText", "primaryText"];
const PURPLE: Family = [
  "tertiaryBrand",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "tertiary",
];
const SUCCESS: Family = [
  "success",
  "onSuccess",
  "successContainer",
  "onSuccessContainer",
  "success",
];
const WARNING: Family = [
  "warning",
  "onWarning",
  "warningContainer",
  "onWarningContainer",
  "warning",
];
const DANGER: Family = ["error", "onError", "errorContainer", "onErrorContainer", "error"];
const ROLE_FAMILIES: Record<string, Family> = {
  primary: BLUE,
  blue: BLUE,
  info: BLUE,
  cinnabar: PURPLE,
  purple: PURPLE,
  violet: PURPLE,
  success: SUCCESS,
  green: SUCCESS,
  mint: SUCCESS,
  warning: WARNING,
  yellow: WARNING,
  danger: DANGER,
  red: DANGER,
};
const ROLE_COLORS = new Set(Object.keys(ROLE_FAMILIES));

/** Mantine's per-colour variant variables, resolved from the scheme's roles. */
function roleVariantVars(r: (typeof roles)["light"] | (typeof roles)["dark"]) {
  const out: Record<string, string> = {};
  for (const [name, [role, on, container, onContainer, text]] of Object.entries(ROLE_FAMILIES)) {
    const v = `--mantine-color-${name}`;
    out[`${v}-filled`] = r[role];
    out[`${v}-filled-hover`] = `color-mix(in srgb, ${r[role]}, ${r[on]} 8%)`;
    out[`${v}-contrast`] = r[on];
    out[`${v}-light`] = r[container];
    out[`${v}-light-hover`] = `color-mix(in srgb, ${r[container]}, ${r[onContainer]} 8%)`;
    out[`${v}-light-color`] = r[onContainer];
    out[`${v}-outline`] = r[text];
    out[`${v}-outline-hover`] = `color-mix(in srgb, ${r[text]} 8%, transparent)`;
    out[`${v}-text`] = r[text];
  }
  for (const k of ["filled", "filled-hover", "contrast", "light", "light-hover", "light-color"]) {
    out[`--mantine-primary-color-${k}`] = out[`--mantine-color-primary-${k}`] ?? "";
  }
  return out;
}

// Re-export font stacks for any caller (SCSS modules, story files) that
// wants them outside the resolver.
export const MEDBRAINS_FONT_STACK = fontFamily.sans;
export const MEDBRAINS_FONT_DISPLAY = fontFamily.display;
export const MEDBRAINS_FONT_MONO = fontFamily.mono;

// ═══════════════════════════════════════════════════════════════════
// ── Container sizes
// ═══════════════════════════════════════════════════════════════════

const CONTAINER_SIZES: Record<string, string> = {
  xxs: rem("200px"),
  xs: rem("320px"),
  sm: rem("420px"),
  md: rem("560px"),
  lg: rem("720px"),
  xl: rem("1280px"),
  xxl: rem("1600px"),
};

// ═══════════════════════════════════════════════════════════════════
// ── Dropdown defaults (Select / DateInput / etc share these)
// ═══════════════════════════════════════════════════════════════════

const MODAL_DROPDOWN_MAX_HEIGHT = 280;

const MODAL_DROPDOWN_PROPS = {
  middlewares: { flip: true, shift: true, size: true },
  position: "bottom-start" as const,
  shadow: "lg",
  withinPortal: true,
  zIndex: zIndex.dropdown,
  styles: {
    dropdown: {
      background: "var(--mb-panel-bg)",
      color: "var(--mb-text-primary)",
      border: "1px solid var(--mb-border)",
      boxShadow: "var(--mb-shadow-md)",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// ── Mantine Theme Factory
// ═══════════════════════════════════════════════════════════════════
//
// Filled / light / outline colours come per scheme from the M3 roles
// (`roleVariantVars`), so `primaryShade` only picks the explicit shade.
//
// Every component's defaultProps reference the dual-mode CSS variables
// emitted by `cssVariableResolver` rather than the raw Mantine palette,
// so dark/light always renders the right value.

export interface CreateMedBrainsThemeOptions {
  /** Optional Mantine loader registry. Pass an `ecg` entry to enable the
   *  branded ECG loader as the default Loader type. */
  loaders?: {
    ecg?: MantineLoaderComponent;
  };
}

/**
 * Build the MedBrains Mantine theme. Pass `opts.loaders.ecg` to register
 * the EcgLoader and set it as the default Loader type. Without it, the
 * default Mantine loader stays in place.
 */
export function createMedBrainsTheme(opts: CreateMedBrainsThemeOptions = {}): MantineThemeOverride {
  const loaderConfig = opts.loaders?.ecg
    ? {
        Loader: Loader.extend({
          defaultProps: {
            // Signature Spectrum ECG loader is the default.
            loaders: { ...Loader.defaultLoaders, ecg: opts.loaders.ecg },
            type: "ecg",
          },
        }),
      }
    : {};

  return createTheme({
    primaryColor: "primary",
    primaryShade: { light: 5, dark: 5 },

    colors: {
      primary: blueTuple,
      blue: blueTuple,
      info: blueTuple,
      // The accent is the M3 tertiary (purple).
      cinnabar: purpleTuple,
      purple: purpleTuple,
      teal: tealTuple,
      mint: greenTuple,
      green: greenTuple,
      success: greenTuple,
      warning: amberTuple,
      yellow: amberTuple,
      danger: redTuple,
      red: redTuple,
      gray: neutralTuple,
      dark: darkTuple,
      violet: purpleTuple,
      orange: ochreTuple,
      slate: slateTuple,
    },

    // A filled role colour takes its own on-colour (white on blue in light,
    // deep blue on light blue in dark), never a fixed white.
    variantColorResolver: (input) => {
      const base = defaultVariantColorsResolver(input);
      return input.variant === "filled" && ROLE_COLORS.has(input.color ?? "")
        ? { ...base, color: `var(--mantine-color-${input.color}-contrast)` }
        : base;
    },

    fontFamily: fontFamily.sans,
    fontFamilyMonospace: fontFamily.mono,
    fontSmoothing: true,

    fontSizes: {
      xs: rem(fontSize.xs),
      sm: rem(fontSize.sm),
      md: rem(fontSize.md),
      lg: rem(fontSize.lg),
      xl: rem(fontSize.xl),
    },

    lineHeights: {
      xs: lineHeight.snug,
      sm: lineHeight.snug,
      md: lineHeight.normal,
      lg: lineHeight.relaxed,
      xl: lineHeight.relaxed,
    },

    spacing: {
      "3xs": rem(space["3xs"]),
      "2xs": rem(space["2xs"]),
      xs: rem(space.xs),
      sm: rem(space.sm),
      md: rem(space.md),
      lg: rem(space.lg),
      xl: rem(space.xl),
      "2xl": rem(space["2xl"]),
      "3xl": rem(space["3xl"]),
    },

    // The website's shape: 8px by default, 14px cards, pill buttons.
    defaultRadius: "sm",

    // Interactive elements show the hand cursor (Mantine defaults to "default",
    // which makes buttons feel unclickable). Pairs with the press transition in
    // signature-spectrum.css for a snappy, tactile click.
    cursorType: "pointer",

    radius: {
      xs: rem(radius.xs),
      sm: rem(radius.sm),
      md: rem(radius.md),
      lg: rem(radius.lg),
      xl: rem(radius.xl),
    },

    headings: {
      // Enterprise-console typography is all-sans — no editorial serif.
      fontFamily: fontFamily.sans,
      fontWeight: fontWeight.semibold,
      // Carbon productive heading scale — a clear, distinct step per level.
      sizes: {
        h1: {
          fontSize: rem(fontSize["4xl"]), // 28
          lineHeight: lineHeight.tight,
          fontWeight: fontWeight.bold,
        },
        h2: {
          fontSize: rem(fontSize["3xl"]), // 24
          lineHeight: lineHeight.tight,
          fontWeight: fontWeight.semibold,
        },
        h3: {
          fontSize: rem(fontSize["2xl"]), // 20
          lineHeight: lineHeight.snug,
          fontWeight: fontWeight.semibold,
        },
        h4: {
          fontSize: rem(fontSize.xl), // 18
          lineHeight: lineHeight.snug,
          fontWeight: fontWeight.semibold,
        },
        h5: {
          fontSize: rem(fontSize.lg), // 16
          lineHeight: lineHeight.snug,
          fontWeight: fontWeight.semibold,
        },
        h6: {
          fontSize: rem(fontSize.md), // 14
          lineHeight: lineHeight.snug,
          fontWeight: fontWeight.semibold,
        },
      },
    },

    // Mantine reads `shadows` as a 5-key record; we publish full xs..2xl
    // via CSS vars below. Mantine's tier maps onto our scale.
    shadows: {
      xs: "var(--mb-shadow-xs)",
      sm: "var(--mb-shadow-sm)",
      md: "var(--mb-shadow-md)",
      lg: "var(--mb-shadow-lg)",
      xl: "var(--mb-shadow-xl)",
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

      // Console surfaces are border-first with no resting shadow.
      Paper: Paper.extend({
        defaultProps: {
          p: "md",
          shadow: undefined,
          radius: "lg",
          withBorder: true,
        },
      }),

      Card: Card.extend({
        defaultProps: {
          p: "md",
          shadow: undefined,
          radius: "lg",
          withBorder: true,
        },
      }),

      Select: Select.extend({
        defaultProps: {
          checkIconPosition: "right",
          comboboxProps: MODAL_DROPDOWN_PROPS,
          maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      MultiSelect: MultiSelect.extend({
        defaultProps: {
          checkIconPosition: "right",
          comboboxProps: MODAL_DROPDOWN_PROPS,
          maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      TagsInput: TagsInput.extend({
        defaultProps: {
          comboboxProps: MODAL_DROPDOWN_PROPS,
          maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      Autocomplete: Autocomplete.extend({
        defaultProps: {
          comboboxProps: MODAL_DROPDOWN_PROPS,
          maxDropdownHeight: MODAL_DROPDOWN_MAX_HEIGHT,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      Combobox: Combobox.extend({
        defaultProps: {
          middlewares: { flip: true, shift: true, size: true },
          shadow: "lg",
          withinPortal: true,
          zIndex: zIndex.dropdown,
        },
      }),

      DateInput: DateInput.extend({
        defaultProps: {
          popoverProps: MODAL_DROPDOWN_PROPS,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      DatePickerInput: DatePickerInput.extend({
        defaultProps: {
          popoverProps: MODAL_DROPDOWN_PROPS,
          radius: "md",
          size: "md",
          variant: "default",
        },
      }),

      DateTimePicker: DateTimePicker.extend({
        defaultProps: {
          popoverProps: MODAL_DROPDOWN_PROPS,
          radius: "md",
          size: "md",
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
          ff: fontFamily.sans,
        },
      },

      Modal: {
        defaultProps: {
          centered: true,
          overlayProps: { backgroundOpacity: 0.4, blur: 8 },
          radius: "lg",
          shadow: "xl",
          // "pop" = scale-from-center + fade; eased with the same easeOutExpo
          // settle curve as the page transition so all motion feels of a piece.
          transitionProps: {
            duration: 220,
            transition: "pop",
            timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
        },
      },

      Badge: {
        defaultProps: {
          variant: "light",
          radius: "sm",
          size: "md",
          fw: 600,
        },
      },

      // Base input height → Carbon field heights (sm 32 / md 40 / lg 48).
      // All single-line inputs (TextInput, PasswordInput, NumberInput, Select,
      // DateInput…) share this base, so their rows align with Button heights.
      Input: {
        vars: (_theme: unknown, props: { size?: string }) => {
          const heights: Record<string, string> = {
            sm: "32px",
            md: "40px",
            lg: "48px",
          };
          const height = typeof props.size === "string" ? heights[props.size] : undefined;
          return { wrapper: height ? { "--input-height": height } : {} };
        },
      },

      TextInput: {
        defaultProps: {
          radius: "md",
          size: "md",
          variant: "default",
        },
      },

      PasswordInput: {
        defaultProps: {
          radius: "md",
          size: "md",
          variant: "default",
        },
      },

      Textarea: {
        defaultProps: {
          radius: "md",
          size: "md",
          variant: "default",
        },
      },

      NumberInput: {
        defaultProps: {
          radius: "md",
          size: "md",
          variant: "default",
        },
      },

      Button: {
        defaultProps: {
          radius: 999,
          fw: 600,
        },
        // Carbon button heights per size (sm 32 / md 40 / lg 48 productive /
        // xl 64). Compact + unlisted sizes keep Mantine's own height.
        vars: (_theme: unknown, props: { size?: string }) => {
          const heights: Record<string, string> = {
            xs: "24px",
            sm: "32px",
            md: "40px",
            lg: "48px",
            xl: "64px",
          };
          const height = typeof props.size === "string" ? heights[props.size] : undefined;
          return { root: height ? { "--button-height": height } : {} };
        },
      },

      NavLink: {
        defaultProps: {
          variant: "subtle",
        },
      },

      // Carbon line tabs — text + icon, blue underline on active, no fill.
      Tabs: {
        defaultProps: {
          variant: "default",
          radius: 0,
          keepMounted: true,
        },
        styles: {
          tab: {
            fontWeight: 400,
            fontSize: "14px",
            color: "var(--mb-text-secondary)",
            padding: "8px 16px",
            borderBottomWidth: "2px",
          },
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

      ...loaderConfig,

      Skeleton: {
        defaultProps: {
          radius: "lg",
        },
      },

      // Signature Spectrum toast look — applies to EVERY notification
      // (toast.* helper AND raw notifications.show). Theme-level so it is
      // layer-safe (Mantine's notification classes are hashed + layered).
      Notification: {
        defaultProps: {
          withBorder: true,
          radius: "lg",
        },
        styles: {
          root: { boxShadow: "var(--mb-shadow-md)" },
          title: { fontWeight: 600, fontSize: "14px", letterSpacing: "-0.01em" },
        },
      },

      // M3 plain tooltip — inverse surface, inverse text.
      Tooltip: {
        defaultProps: {
          withArrow: true,
          radius: 0,
          fz: "xs",
          transitionProps: { duration: 150, transition: "fade" },
        },
        styles: {
          tooltip: {
            background: "var(--mb-inverse-surface)",
            color: "var(--mb-inverse-on-surface)",
            fontSize: "12px",
            fontWeight: 400,
            padding: "4px 8px",
          },
        },
      },

      Drawer: {
        defaultProps: {
          shadow: "xl",
          transitionProps: { duration: 300, timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" },
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
            boxShadow: "var(--mb-shadow-md)",
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
      style: "m3-blue",
      fontDisplay: fontFamily.display,
      fontSans: fontFamily.sans,
      fontMono: fontFamily.mono,
      duration,
      easing,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// ── CSS variable resolver — dual-mode token publication
// ═══════════════════════════════════════════════════════════════════
//
// Produces three slots:
//   `variables` — emitted in both light and dark (font stacks, motion,
//                 emergency codes, container sizes).
//   `light`     — light scheme palette (white canvas).
//   `dark`      — pure-black night scheme palette.
//
// Mantine picks the active slot from
// `data-mantine-color-scheme="light"|"dark"` on `<html>`.

function buildSchemePalette(scheme: typeof lightScheme, name: SchemeName) {
  const isLight = name === "light";
  const r = roles[name];
  const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  return {
    // ── M3 roles straight from the Figma spec (surface-container, on-*,
    //    state-*, clinical-*, emergency-*) ─────────────────────────────
    ...roleCssVars[name],
    ...roleVariantVars(r),

    // ── Mantine baseline overrides ────────────────────────────────
    "--mantine-color-body": scheme.bg.canvas,
    "--mantine-color-text": scheme.fg.default,
    "--mantine-color-dimmed": scheme.fg.muted,
    // The field's own placeholder token, not `fg.faint`: faint also colours
    // disabled text (exempt from contrast), a placeholder is not.
    "--mantine-color-placeholder": scheme.input.placeholder,
    "--mantine-color-error": scheme.status.danger.fg,
    "--mantine-color-anchor": scheme.fg.link,
    "--mantine-color-default": scheme.bg.default,
    "--mantine-color-default-hover": scheme.bg.subtle,
    "--mantine-color-default-color": scheme.fg.default,
    "--mantine-color-default-border": scheme.border.default,

    // ── Anatomy model (body-site picker) ─────────────────────────
    ...Object.fromEntries(
      Object.entries(ANATOMY_PALETTE).map(([k, v]) => [`--mb-anatomy-${k}`, v]),
    ),

    // ── Surface tiers ────────────────────────────────────────────
    "--mb-bg-canvas": scheme.bg.canvas,
    "--mb-bg-content": scheme.bg.canvas,
    "--mb-bg-default": scheme.bg.default,
    "--mb-bg-subtle": scheme.bg.subtle,
    "--mb-bg-muted": scheme.bg.muted,
    "--mb-bg-emphasis": scheme.bg.emphasis,
    "--mb-bg-inverse": scheme.bg.inverse,
    "--mb-bg-overlay": scheme.bg.overlay,
    "--mb-overlay-bg": scheme.bg.overlay,
    "--mb-card-bg": scheme.bg.default,
    "--mb-panel-bg": scheme.bg.subtle,
    "--mb-input-bg": scheme.input.bg,
    "--mb-sidebar-bg": scheme.nav.bg,
    "--mb-header-bg": scheme.header.bg,
    "--mb-search-bg": scheme.header.searchBg,

    // ── Borders ──────────────────────────────────────────────────
    "--mb-border": scheme.border.default,
    "--mb-border-default": scheme.border.default,
    "--mb-border-subtle": scheme.border.muted,
    "--mb-border-strong": scheme.border.strong,
    "--mb-border-focus": scheme.border.focus,

    // ── Foreground hierarchy ─────────────────────────────────────
    "--mb-text-heading": scheme.fg.default,
    "--mb-text-body": scheme.fg.default,
    "--mb-text-primary": scheme.fg.default,
    "--mb-text-secondary": scheme.fg.muted,
    "--mb-text-subtle": scheme.fg.muted,
    "--mb-text-muted": scheme.fg.subtle,
    "--mb-text-caption": scheme.fg.subtle,
    "--mb-text-faint": scheme.fg.faint,
    "--mb-text-disabled": scheme.fg.faint,
    "--mb-text-on-emphasis": scheme.fg.onEmphasis,
    "--mb-text-on-accent": scheme.fg.onAccent,
    "--mb-text-on-inverse": scheme.fg.onInverse,

    // ── Typography rhythm (mode-agnostic) ────────────────────────
    "--mb-letter-spacing": letterSpacing.normal,
    "--mb-line-height-title": lineHeight.tight,
    "--mb-line-height-ui": lineHeight.snug,
    "--mb-line-height-body": lineHeight.normal,
    "--mb-line-height-table": lineHeight.snug,
    "--mb-line-height-caption": lineHeight.snug,
    "--mb-font-weight-heading": fontWeight.semibold,
    "--mb-font-weight-title": fontWeight.semibold,
    "--mb-font-weight-subtitle": fontWeight.medium,
    "--mb-font-weight-body": fontWeight.regular,
    "--mb-font-weight-label": fontWeight.medium,
    "--mb-font-weight-table-header": fontWeight.semibold,
    "--mb-font-weight-table-body": fontWeight.regular,
    "--mb-font-weight-patient": fontWeight.semibold,
    "--mb-font-weight-indicator": fontWeight.semibold,
    "--mb-font-weight-action": fontWeight.semibold,

    // ── Brand ────────────────────────────────────────────────────
    "--mb-brand-fg": scheme.brand.fg,
    "--mb-brand-bg": scheme.brand.bg,
    "--mb-brand-emphasis": scheme.brand.emphasis,
    "--mb-brand-emphasis-hover": scheme.brand.emphasisHover,
    "--mb-brand-emphasis-pressed": scheme.brand.emphasisPressed,
    "--mb-brand-on-emphasis": scheme.brand.onEmphasis,
    "--mb-brand-tint": scheme.brand.tint,
    "--mb-brand-tint-strong": scheme.brand.tintStrong,
    "--mb-brand-outline": scheme.brand.outline,

    // ── Accent (reserved) ────────────────────────────────────────
    "--mb-accent-fg": scheme.accent.fg,
    "--mb-accent-bg": scheme.accent.bg,
    "--mb-accent-emphasis": scheme.accent.emphasis,
    "--mb-accent-on-emphasis": scheme.accent.onEmphasis,
    "--mb-accent-tint": scheme.accent.tint,

    // ── Interactive ──────────────────────────────────────────────
    "--mb-selection-bg": scheme.selection.bg,
    "--mb-selection-text": scheme.selection.text,
    "--mb-focus-ring": scheme.border.focus,
    "--mb-link": scheme.fg.link,
    "--mb-link-hover": scheme.fg.linkHover,
    "--mb-active-bg": scheme.nav.activeBg,
    "--mb-active-bg-strong": scheme.brand.tintStrong,
    "--mb-active-border": scheme.border.focus,
    "--mb-active-text": scheme.nav.activeText,
    "--mb-icon-glow": r.statePrimary8,

    // ── Navigation ───────────────────────────────────────────────
    "--mb-nav-bg": scheme.nav.bg,
    "--mb-nav-text": scheme.nav.text,
    "--mb-nav-hover-bg": scheme.nav.hoverBg,
    "--mb-nav-hover-text": scheme.nav.hoverText,
    "--mb-nav-active-bg": scheme.nav.activeBg,
    "--mb-nav-active-text": scheme.nav.activeText,
    "--mb-nav-active-shadow": scheme.nav.activeShadow,
    "--mb-nav-active-indicator": scheme.nav.activeIndicator,
    "--mb-nav-child-active-bg": scheme.nav.childActiveBg,
    "--mb-nav-child-active-text": scheme.nav.childActiveText,
    "--mb-nav-child-active-border": scheme.nav.childActiveBorder,

    // ── Inputs ───────────────────────────────────────────────────
    "--mb-input-border": scheme.input.border,
    "--mb-input-border-hover": scheme.input.borderHover,
    "--mb-input-placeholder": scheme.input.placeholder,
    "--mb-input-focus-ring": scheme.input.focusRing,
    "--mb-input-focus-border": scheme.input.focusBorder,

    // ── Status tokens (success / warning / danger / info / etc) ──
    "--mb-success-fg": scheme.status.success.fg,
    "--mb-success-bg": scheme.status.success.bg,
    "--mb-success-border": scheme.status.success.border,
    "--mb-success-accent": scheme.status.success.emphasis,
    "--mb-success-text": scheme.status.success.fg,
    "--mb-warning-fg": scheme.status.warning.fg,
    "--mb-warning-bg": scheme.status.warning.bg,
    "--mb-warning-border": scheme.status.warning.border,
    "--mb-warning-accent": scheme.status.warning.emphasis,
    "--mb-warning-text": scheme.status.warning.fg,
    "--mb-danger-fg": scheme.status.danger.fg,
    "--mb-danger-bg": scheme.status.danger.bg,
    "--mb-danger-border": scheme.status.danger.border,
    "--mb-danger-accent": scheme.status.danger.emphasis,
    "--mb-danger-text": scheme.status.danger.fg,
    "--mb-info-fg": scheme.status.info.fg,
    "--mb-info-bg": scheme.status.info.bg,
    "--mb-info-border": scheme.status.info.border,
    "--mb-info-accent": scheme.status.info.emphasis,
    "--mb-info-text": scheme.status.info.fg,
    "--mb-neutral-fg": scheme.status.neutral.fg,
    "--mb-neutral-bg": scheme.status.neutral.bg,
    "--mb-neutral-border": scheme.status.neutral.border,
    "--mb-neutral-accent": scheme.status.neutral.emphasis,
    "--mb-neutral-text": scheme.status.neutral.fg,
    "--mb-orange-fg": scheme.status.orange.fg,
    "--mb-orange-bg": scheme.status.orange.bg,
    "--mb-orange-border": scheme.status.orange.border,
    "--mb-orange-accent": scheme.status.orange.emphasis,
    "--mb-orange-text": scheme.status.orange.fg,
    "--mb-violet-fg": scheme.status.violet.fg,
    "--mb-violet-bg": scheme.status.violet.bg,
    "--mb-violet-border": scheme.status.violet.border,
    "--mb-violet-accent": scheme.status.violet.emphasis,
    "--mb-violet-text": scheme.status.violet.fg,

    // ── Clinical safety (high-visibility patient state) ──────────
    "--mb-critical-bg": scheme.status.danger.bg,
    "--mb-critical-text": scheme.status.danger.fg,
    "--mb-critical-border": scheme.status.danger.border,
    "--mb-abnormal-bg": scheme.status.warning.bg,
    "--mb-abnormal-text": scheme.status.warning.fg,
    "--mb-abnormal-border": scheme.status.warning.border,
    "--mb-normal-bg": scheme.status.success.bg,
    "--mb-normal-text": scheme.status.success.fg,
    "--mb-normal-border": scheme.status.success.border,

    // ── Patient identity chips (mode-aware contrast) ─────────────
    "--mb-gender-male-bg": isLight ? "#E1F2FF" : "#0B3B6F",
    "--mb-gender-male-text": isLight ? "#0B3B6F" : "#E8F6FF",
    "--mb-gender-male-border": "#38BDF8",
    "--mb-gender-female-bg": isLight ? "#FFE4EF" : "#65112B",
    "--mb-gender-female-text": isLight ? "#9F1239" : "#FFE8F1",
    "--mb-gender-female-border": "#FB7185",
    "--mb-gender-other-bg": isLight ? "#EEE6FF" : "#39206B",
    "--mb-gender-other-text": isLight ? "#5B21B6" : "#F2EAFE",
    "--mb-gender-other-border": "#A78BFA",
    "--mb-gender-unknown-bg": isLight ? "#FFF6D6" : "#3A2A00",
    "--mb-gender-unknown-text": isLight ? "#78350F" : "#FFF8D6",
    "--mb-gender-unknown-border": "#FACC15",

    // ── Accent fills (flat Carbon solids — no gradients) ─────────
    "--mb-accent-primary": scheme.brand.emphasis,
    "--mb-accent-success": scheme.status.success.emphasis,
    "--mb-accent-warning": scheme.status.warning.emphasis,
    "--mb-accent-danger": scheme.status.danger.emphasis,
    "--mb-accent-info": scheme.status.info.emphasis,
    "--mb-accent-orange": scheme.status.orange.emphasis,
    "--mb-accent-violet": scheme.status.violet.emphasis,
    "--mb-accent-neutral": scheme.status.neutral.emphasis,

    // ── Legacy/alias tokens ──────────────────────────────────────
    // Older SCSS references these bare names, which the resolver never emitted —
    // so they fell back to hardcoded LIGHT hex and rendered light-on-dark. Emit
    // them here (dual-mode) so every existing usage adapts to the scheme.
    "--mb-brand": scheme.brand.emphasis,
    // Brand purple #851B7F in both schemes (white text 8.5:1): the AI accent
    // fill only — AI buttons, AI labels, the orb. Purple text uses tertiary.
    "--mb-brand-purple": r.tertiaryBrand,
    // The website's heartbeat green: live dots, the logo beat, the ECG beacon.
    "--mb-pulse": ramps.Site.pulse,
    // The AI gradient as small text, from the text roles of each scheme.
    "--mb-gradient-ai-text": `linear-gradient(135deg, ${r.primaryText} 0%, ${r.tertiary} 100%)`,
    "--mb-interactive": scheme.brand.emphasis,
    "--mb-brand-bg-hover": scheme.brand.tintStrong,
    "--mb-bg": scheme.bg.default,
    "--mb-bg-hover": scheme.bg.subtle,
    "--mb-text": scheme.fg.default,
    "--mb-danger": scheme.status.danger.emphasis,
    "--mb-support-error": scheme.status.danger.emphasis,
    "--mb-success": scheme.status.success.emphasis,
    "--mb-warning": scheme.status.warning.emphasis,
    "--mb-selected-row-bg": scheme.table.selected,
    "--mb-selected-row-bg-hover": scheme.table.hover,

    // ── Indicators (raw, mode-agnostic safety colors) ────────────
    "--mb-indicator-primary": sharedReferences.indicators.primary,
    "--mb-indicator-success": sharedReferences.indicators.success,
    "--mb-indicator-green": sharedReferences.indicators.success,
    "--mb-indicator-warning": sharedReferences.indicators.warning,
    "--mb-indicator-yellow": sharedReferences.indicators.warning,
    "--mb-indicator-orange": sharedReferences.indicators.orange,
    "--mb-indicator-danger": sharedReferences.indicators.danger,
    "--mb-indicator-red": sharedReferences.indicators.danger,
    "--mb-indicator-info": sharedReferences.indicators.info,
    "--mb-indicator-blue": sharedReferences.indicators.info,
    "--mb-indicator-violet": sharedReferences.indicators.violet,
    "--mb-indicator-purple": sharedReferences.indicators.violet,
    "--mb-indicator-slate": sharedReferences.indicators.slate,
    "--mb-indicator-gray": sharedReferences.indicators.slate,
    "--mb-indicator-neutral": sharedReferences.indicators.slate,

    // ── Tables ───────────────────────────────────────────────────
    "--mb-table-bg": scheme.table.bg,
    "--mb-table-header-bg": scheme.table.headerBg,
    "--mb-table-header-text": scheme.table.headerText,
    "--mb-table-text": scheme.table.text,
    "--mb-table-text-muted": scheme.table.textMuted,
    "--mb-table-hover": scheme.table.hover,
    "--mb-table-selected-bg": scheme.table.selected,
    "--mb-table-border": scheme.table.border,

    // ── Chips ────────────────────────────────────────────────────
    "--mb-chip-bg": scheme.chip.bg,
    "--mb-chip-text": scheme.chip.text,
    "--mb-chip-border": scheme.chip.border,

    // ── Action surfaces (button default variant, ActionIcon) ─────
    "--mb-action-surface-bg": scheme.bg.default,
    "--mb-action-surface-hover-bg": scheme.bg.subtle,
    "--mb-action-surface-border": scheme.border.default,
    "--mb-action-surface-text": scheme.fg.default,

    // ── Skeleton shimmer ─────────────────────────────────────────
    "--mb-shimmer-from": scheme.shimmer.from,
    "--mb-shimmer-mid": scheme.shimmer.mid,

    // ── Shadows (tier xs..2xl + composed card hover) ─────────────
    "--mb-shadow-xs": scheme.shadow.xs,
    "--mb-shadow-sm": scheme.shadow.sm,
    "--mb-shadow-md": scheme.shadow.md,
    "--mb-shadow-lg": scheme.shadow.lg,
    "--mb-shadow-xl": scheme.shadow.xl,
    "--mb-shadow-2xl": scheme.shadow["2xl"],
    "--mb-shadow-soft": scheme.shadow.sm,
    "--mb-float-shadow": scheme.shadow.lg,
    "--mb-card-hover-shadow": scheme.shadow.cardHover,

    // ── Glass-overlay tints (composited on accents) ──────────────
    "--mb-glass-from": mix(r.surface, 94),
    "--mb-glass-to": mix(r.surfaceContainerLow, 82),
    "--mb-shadow-brand-tint": r.statePrimary12,
    "--mb-shadow-accent-tint": mix(r.tertiary, 18),
    "--mb-scrollbar-track": r.statePrimary8,
    // Primary-blue accent — lighter when idle, full brand blue on hover/active.
    "--mb-scrollbar-thumb": mix(r.primary, 40),
    "--mb-scrollbar-thumb-hover": mix(r.primary, 75),

    // ── Legacy brand/accent aliases (semantic, used across SCSS) ──
    "--fc-brand": scheme.brand.emphasis,
    "--fc-brand-hover": scheme.brand.emphasisHover,
    "--fc-brand-deep": scheme.brand.emphasisPressed,
    "--fc-ink": scheme.fg.default,
    "--fc-sub": scheme.fg.muted,
    "--fc-muted": scheme.fg.subtle,
    "--fc-faint": scheme.fg.faint,
    "--fc-rule": scheme.border.default,
    "--fc-rule-soft": scheme.border.muted,
    "--fc-canvas": scheme.bg.canvas,
    "--fc-panel": scheme.bg.subtle,
    "--fc-surface": scheme.bg.default,
    "--fc-tint": scheme.brand.tint,
    "--fc-tint-2": scheme.brand.tintStrong,
    "--fc-outline": scheme.brand.outline,
    "--fc-copper": scheme.accent.emphasis,
    "--fc-copper-tint": scheme.accent.tint,
    "--fc-copper-deep": scheme.accent.fg,
  };
}

export const cssVariableResolver: CSSVariablesResolver = (t) => {
  const lightPalette = buildSchemePalette(lightScheme, "light");
  // Dark theme (Apple pure-black scheme) re-enabled.
  const darkPalette = buildSchemePalette(darkScheme, "dark");
  return {
    variables: {
      // ── Geometry / sizing (mode-agnostic) ────────────────────
      "--mb-radius": t.radius?.lg ?? rem(radius.lg),
      "--mb-page-header-padding-y": rem(space["3xs"]),
      "--mb-page-header-padding-x": rem(space.xs),
      "--mb-page-header-icon-size": rem("24px"),
      "--mb-component-underline": "var(--mb-accent-primary)",
      "--mb-selected-edge": "var(--mb-accent-primary)",
      // Page header background composed at consume time using mode-specific bgs
      "--mb-page-header-bg": "var(--mb-bg-default)",
      "--mb-table-toolbar-bg": "var(--mb-bg-default)",
      // Brand gradients are blue only: the purple accent never fills a full-width
      // banner, which would read like an emergency alert. The accent bar on
      // page headers + CTAs use "signal"; soft tints/washes use "mist".
      // Both stops hold white text at AA (blue 5:1, blue-deep 6.6:1).
      "--mb-gradient-signal": `linear-gradient(135deg, ${ramps.Site.blue} 0%, ${ramps.Site.blueDeep} 100%)`,
      "--mb-gradient-lifeline": `linear-gradient(135deg, ${ramps.Site.blueDeep} 0%, ${ramps.Site.blue} 50%, ${ramps.Site.blueDeep} 100%)`,
      "--mb-gradient-mist": `linear-gradient(135deg, ${ramps.Site.sky} 0%, ${ramps.Site.blueTint} 100%)`,
      "--mb-gradient-nightshift": `linear-gradient(160deg, ${ramps.Site.night} 0%, ${ramps.Site.blueDeep} 70%, ${ramps.Site.blue} 100%)`,
      "--mb-gradient-text": `linear-gradient(120deg, ${ramps.Site.blueDeep} 0%, ${ramps.Site.blue} 45%, ${ramps.Site.purple} 100%)`,
      // AI signature — blue → brand purple. Marks AI-supported surfaces only
      // (the AiLabel slug border + "AI" glyph). Carbon reserves this for
      // genuinely AI-touched content; do not use it as generic decoration.
      // Mascot illustration ink and eye-white: the same in both schemes, since
      // the crab's eyes are always white with dark pupils.
      "--mb-mascot-ink": ramps.Site.ink,
      "--mb-mascot-eye": ramps.Site.paper,
      "--mb-gradient-ai": `linear-gradient(135deg, ${ramps.Site.blue} 0%, ${ramps.Site.purple} 100%)`,
      "--mb-accent-gradient": "var(--mb-gradient-signal)",
      "--mb-accent-gradient-soft": "var(--mb-brand-bg)",
      "--mb-signature-spectrum": "var(--mb-gradient-signal)",
      "--mb-signature-spectrum-soft": "var(--mb-gradient-mist)",
      // The brand stage: the sign-in page's deep navy with blue and green
      // light, the same as www.medbrains.in. Fixed in both colour schemes; text
      // on it is white or white at 80% (both pass WCAG AA on the navy).
      "--mb-stage-bg":
        "radial-gradient(900px 600px at 15% 0%, rgb(15 98 254 / 38%), transparent 65%), " +
        "radial-gradient(700px 500px at 0% 100%, rgb(66 190 101 / 22%), transparent 65%), " +
        "linear-gradient(160deg, #0a1630 0%, #0f1f42 100%)",
      "--mb-stage-text": "#ffffff",
      "--mb-stage-text-muted": "rgb(255 255 255 / 80%)",
      "--mb-stage-line": "rgb(255 255 255 / 14%)",
      "--mb-stage-surface": "rgb(255 255 255 / 6%)",
      "--mb-stage-accent": "#42be65",
      "--mb-stage-sky": "#78a9ff",
      // A card standing on the stage in the dark scheme: one step up the navy.
      "--mb-stage-card": "#0f1f42",
      "--mb-stage-shadow": "0 1px 2px rgb(0 0 0 / 20%), 0 24px 64px rgb(0 0 0 / 40%)",
      "--mb-font-display": "'Archivo Variable', 'Archivo', system-ui, sans-serif",

      // ── Motion (mode-agnostic) ───────────────────────────────
      "--mb-duration-instant": duration.instant,
      "--mb-duration-fast": duration.fast,
      "--mb-duration-medium": duration.medium,
      "--mb-duration-slow": duration.slow,
      "--mb-duration-slower": duration.slower,
      "--mb-duration-ambient": duration.ambient,
      "--mb-easing-standard": easing.standard,
      "--mb-easing-emphasis": easing.emphasis,
      "--mb-easing-decel": easing.decel,
      "--mb-easing-accel": easing.accel,
      "--mb-easing-linear": easing.linear,

      // ── Emergency Code Layer (NOT themeable — safety critical) ──
      // Same values as the --mb-emergency-* roles; both names stay.
      "--code-blue": emergencyCodes.blue,
      "--code-red": emergencyCodes.red,
      "--code-pink": emergencyCodes.pink,
      "--code-black": emergencyCodes.black,
      "--code-yellow": emergencyCodes.yellow,
      "--code-orange": emergencyCodes.orange,

      // ── Font stacks ──────────────────────────────────────────
      "--font-display": fontFamily.display,
      "--font-sans": fontFamily.sans,
      "--font-mono": fontFamily.mono,
      "--fc-font-display": fontFamily.display,
      "--fc-font-sans": fontFamily.sans,
      "--fc-font-mono": fontFamily.mono,

      // ── Z-index ──────────────────────────────────────────────
      "--mb-z-base": String(zIndex.base),
      "--mb-z-raised": String(zIndex.raised),
      "--mb-z-sticky": String(zIndex.sticky),
      "--mb-z-app-shell": String(zIndex.appShell),
      "--mb-z-top-progress": String(zIndex.topProgress),
      "--mb-z-dropdown": String(zIndex.dropdown),
      "--mb-z-overlay": String(zIndex.overlay),
      "--mb-z-modal": String(zIndex.modal),
      "--mb-z-popover": String(zIndex.popover),
      "--mb-z-tooltip": String(zIndex.tooltip),
      "--mb-z-toast": String(zIndex.toast),
      "--mb-z-spotlight": String(zIndex.spotlight),
    },
    light: lightPalette,
    dark: darkPalette,
  };
};
