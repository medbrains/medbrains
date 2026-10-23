/**
 * MedBrains Design System — Tier 2: Semantic Tokens
 *
 * Maps the Material-3 colour roles (`colors.generated.ts`, generated from the
 * Figma library spec) onto the long-standing `--mb-*` names (`fg-default`,
 * `bg-canvas`, `border-default`, …) so existing components keep working. Both
 * schemes come from the same mapping — only the role values differ.
 *
 * Rules: blue = brand, primary actions, focus. Teal (tertiary) = positive data
 * accent. Green / amber / red only for clinical meaning, always with an icon or
 * word. Emergency code colours are fixed.
 *
 * Component code MUST NOT cherry-pick primitive hexes. Always reference
 * a semantic role. If a role does not exist, extend the schema here.
 */

import { ramps, roles } from "./colors.generated";
import { shadowDark, shadowLight, violet } from "./primitives";

export interface SemanticScheme {
  bg: {
    canvas: string;
    default: string;
    subtle: string;
    muted: string;
    emphasis: string;
    inverse: string;
    overlay: string;
  };
  fg: {
    default: string;
    muted: string;
    subtle: string;
    faint: string;
    onEmphasis: string;
    onAccent: string;
    onInverse: string;
    link: string;
    linkHover: string;
  };
  border: {
    default: string;
    muted: string;
    strong: string;
    focus: string;
  };
  brand: {
    fg: string;
    bg: string;
    emphasis: string;
    emphasisHover: string;
    emphasisPressed: string;
    muted: string;
    onEmphasis: string;
    tint: string;
    tintStrong: string;
    outline: string;
  };
  accent: {
    fg: string;
    bg: string;
    emphasis: string;
    onEmphasis: string;
    tint: string;
  };
  status: {
    success: StatusScale;
    warning: StatusScale;
    danger: StatusScale;
    info: StatusScale;
    neutral: StatusScale;
    orange: StatusScale;
    violet: StatusScale;
  };
  nav: {
    bg: string;
    text: string;
    hoverBg: string;
    hoverText: string;
    activeBg: string;
    activeText: string;
    activeShadow: string;
    activeIndicator: string;
    childActiveBg: string;
    childActiveText: string;
    childActiveBorder: string;
  };
  header: {
    bg: string;
    border: string;
    searchBg: string;
  };
  input: {
    bg: string;
    border: string;
    borderHover: string;
    placeholder: string;
    focusRing: string;
    focusBorder: string;
  };
  table: {
    bg: string;
    headerBg: string;
    headerText: string;
    text: string;
    textMuted: string;
    hover: string;
    selected: string;
    border: string;
  };
  chip: {
    bg: string;
    text: string;
    border: string;
  };
  shadow: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    cardHover: string;
  };
  shimmer: {
    from: string;
    mid: string;
  };
  selection: {
    bg: string;
    text: string;
  };
}

export interface StatusScale {
  fg: string;
  bg: string;
  border: string;
  emphasis: string;
  onEmphasis: string;
}

type Roles = (typeof roles)["light"] | (typeof roles)["dark"];

/** A status scale from one M3 role family: the role reads ≥ 5:1 on its container. */
function statusScale(role: string, container: string, on: string): StatusScale {
  return { fg: role, bg: container, border: role, emphasis: role, onEmphasis: on };
}

/** M3 hover/press layer: the on-colour over the fill at 8% / 12%. */
const stateLayer = (fill: string, on: string, pct: number) =>
  `color-mix(in srgb, ${fill}, ${on} ${pct}%)`;

function fromRoles(r: Roles, isLight: boolean): SemanticScheme {
  const shadow = isLight ? shadowLight : shadowDark;
  return {
    bg: {
      canvas: r.surface,
      // Cards sit one step off the canvas: up to white in light, up in dark.
      default: isLight ? r.surfaceContainerLowest : r.surfaceContainerLow,
      subtle: r.surfaceContainer,
      muted: r.surfaceContainerHigh,
      emphasis: r.primary,
      inverse: r.inverseSurface,
      overlay: `${r.scrim}${isLight ? "52" : "99"}`, // scrim at 32% / 60%
    },
    fg: {
      default: r.onSurface,
      muted: r.onSurfaceVariant,
      subtle: r.onSurfaceVariant,
      faint: r.outline,
      onEmphasis: r.onPrimary,
      onAccent: r.onTertiary,
      onInverse: r.inverseOnSurface,
      link: r.primary,
      linkHover: r.primary,
    },
    border: {
      default: r.outlineVariant,
      muted: r.outlineVariant,
      strong: r.outline,
      focus: r.primary,
    },
    brand: {
      fg: r.primary,
      bg: r.statePrimary8,
      emphasis: r.primary,
      emphasisHover: stateLayer(r.primary, r.onPrimary, 8),
      emphasisPressed: stateLayer(r.primary, r.onPrimary, 12),
      muted: r.statePrimary8,
      onEmphasis: r.onPrimary,
      tint: r.statePrimary12,
      tintStrong: r.statePrimaryContainer12,
      outline: r.inversePrimary,
    },
    accent: {
      fg: r.tertiary,
      bg: r.tertiaryContainer,
      emphasis: r.tertiary,
      onEmphasis: r.onTertiary,
      tint: r.tertiaryContainer,
    },
    status: {
      success: statusScale(r.success, r.successContainer, r.onSuccess),
      warning: statusScale(r.warning, r.warningContainer, r.onWarning),
      danger: statusScale(r.error, r.errorContainer, r.onError),
      info: statusScale(r.primary, r.surfaceVariant, r.onPrimary),
      neutral: {
        fg: r.onSurfaceVariant,
        bg: r.surfaceContainerHigh,
        border: r.outlineVariant,
        emphasis: r.onSurfaceVariant,
        onEmphasis: r.surface,
      },
      // Orange is not a role: it reads as amber (attention), never decoration.
      orange: statusScale(r.warning, r.warningContainer, r.onWarning),
      // Violet marks AI-supported content only (Carbon AI signature).
      violet: {
        fg: isLight ? violet[6] : violet[2],
        bg: isLight ? violet[0] : violet[8],
        border: violet[isLight ? 2 : 6],
        emphasis: violet[5],
        onEmphasis: r.onPrimary,
      },
    },
    nav: {
      bg: r.surfaceContainerLow,
      text: r.onSurfaceVariant,
      hoverBg: r.stateOnSurface8,
      hoverText: r.onSurface,
      activeBg: r.statePrimary12,
      activeText: r.primary,
      activeShadow: `inset 3px 0 0 0 ${r.primary}`,
      activeIndicator: r.primary,
      childActiveBg: r.statePrimary8,
      childActiveText: r.primary,
      childActiveBorder: r.primary,
    },
    header: {
      bg: r.surface,
      border: r.outlineVariant,
      searchBg: r.surfaceContainerHigh,
    },
    input: {
      bg: r.surfaceContainerLowest,
      border: r.outline,
      borderHover: r.onSurface,
      placeholder: r.onSurfaceVariant,
      focusRing: r.primary,
      focusBorder: r.primary,
    },
    table: {
      bg: isLight ? r.surfaceContainerLowest : r.surfaceContainerLow,
      headerBg: r.surfaceContainer,
      headerText: r.onSurface,
      text: r.onSurface,
      textMuted: r.onSurfaceVariant,
      hover: r.stateOnSurface8,
      selected: r.statePrimary12,
      border: r.outlineVariant,
    },
    chip: {
      bg: r.surfaceContainerLow,
      text: r.onSurfaceVariant,
      border: r.outlineVariant,
    },
    shadow: {
      ...shadow,
      cardHover: shadow.md,
    },
    shimmer: {
      from: r.surfaceContainer,
      mid: r.surfaceContainerHigh,
    },
    selection: {
      bg: r.inversePrimary,
      text: isLight ? r.onSurface : r.onPrimaryContainer,
    },
  };
}

export const lightScheme: SemanticScheme = fromRoles(roles.light, true);
export const darkScheme: SemanticScheme = fromRoles(roles.dark, false);

// ═══════════════════════════════════════════════════════════════════
// ── Scheme Registry
// ═══════════════════════════════════════════════════════════════════

export const schemes = {
  light: lightScheme,
  dark: darkScheme,
} as const;

export type SchemeName = keyof typeof schemes;

/** Mode-agnostic indicator dots/bars (always paired with an icon or word). */
export const sharedReferences = {
  indicators: {
    primary: ramps.Blue["40"],
    teal: ramps.Teal["50"],
    success: ramps.Green["50"],
    warning: ramps.Amber["60"],
    danger: ramps.Red["50"],
    info: ramps.Blue["40"],
    violet: violet[5],
    orange: ramps.Amber["60"],
    slate: ramps.Neutral["50"],
  },
} as const;
