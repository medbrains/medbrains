/**
 * MedBrains Design System — Tier 2: Semantic Tokens
 *
 * Maps primitives (`primitives.ts`) to roles (`fg-default`, `bg-canvas`,
 * `border-default`, etc.). Two schemes — `lightScheme` (LOCKED Apple-class
 * default: white canvas, System Blue brand, Cinnabar accent) and
 * `darkScheme` (Apple pure-black canvas variant for OT / ICU / night).
 *
 * Component code MUST NOT cherry-pick primitive hexes. Always reference
 * a semantic role. If a role does not exist, extend the schema here.
 */

import {
  amber,
  blue,
  cinnabar,
  ink,
  inkDark,
  mint,
  ochre,
  rose,
  shadowDark,
  shadowLight,
  sky,
  slate,
  violet,
} from "./primitives";

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

// ═══════════════════════════════════════════════════════════════════
// ── LIGHT SCHEME — Apple-class default (LOCKED)
// ═══════════════════════════════════════════════════════════════════
//
// Pure white canvas. Apple-warm system grays for text + chrome. System
// Blue brand. Cinnabar accent (reserved). Mint for vitals + success.
// Peers: Apple Health, Stripe-clean, Linear-light, GitHub-light.

export const lightScheme: SemanticScheme = {
  bg: {
    canvas: "#FFFFFF",
    default: "#FFFFFF",
    subtle: "#F4F5F8", // Experian cool panel
    muted: "#ECEEF3", // fog panel
    emphasis: blue[5], // Experian blue surface
    inverse: "#1A1A2E",
    overlay: "rgba(26, 26, 46, 0.36)",
  },
  fg: {
    default: "#1A1A2E", // Experian near-black body text
    muted: "#5F6B7A", // secondary gray
    subtle: "#5F6B7A",
    faint: "#9AA4B2", // placeholder
    onEmphasis: "#FFFFFF",
    onAccent: "#FFFFFF",
    onInverse: "#F4F5F8",
    link: blue[6], // #463AA8 — AAA link
    linkHover: blue[7],
  },
  border: {
    default: "#D5DBDB", // Experian hairline
    muted: "#E7EAEF",
    strong: "#B6BFC9",
    focus: blue[5],
  },
  brand: {
    fg: blue[6], // #0052A3 — readable on white
    bg: blue[0], // #E6F1FF
    emphasis: blue[5], // #0066CC LOCKED
    emphasisHover: blue[6],
    emphasisPressed: blue[7],
    muted: blue[0],
    onEmphasis: "#FFFFFF",
    tint: "#ECF1F8", // active nav pill (Experian blue tint)
    tintStrong: blue[1],
    outline: blue[2],
  },
  accent: {
    fg: cinnabar[6], // #962623 readable on white
    bg: cinnabar[0], // #FDE9E6
    emphasis: cinnabar[5], // #B7322E LOCKED
    onEmphasis: "#FFFFFF",
    tint: cinnabar[0],
  },
  status: {
    success: {
      fg: "#047857",
      bg: "#D1FAE5",
      border: mint[2],
      emphasis: mint[5], // #1CB785
      onEmphasis: "#FFFFFF",
    },
    warning: {
      fg: "#B45309",
      bg: "#FEF3C7",
      border: amber[2],
      emphasis: amber[5], // #FF9F0A
      onEmphasis: amber[9],
    },
    danger: {
      fg: "#B91C1C",
      bg: "#FEE2E2",
      border: rose[2],
      emphasis: rose[5], // #FF453A
      onEmphasis: "#FFFFFF",
    },
    info: {
      fg: "#0369A1",
      bg: "#E0F2FE",
      border: sky[2],
      emphasis: sky[5], // #0A84FF
      onEmphasis: "#FFFFFF",
    },
    neutral: {
      fg: ink[7],
      bg: ink[1],
      border: ink[3],
      emphasis: ink[5],
      onEmphasis: "#FFFFFF",
    },
    orange: {
      fg: "#7C2D12",
      bg: "#FFEDD5",
      border: ochre[2],
      emphasis: ochre[5],
      onEmphasis: "#FFFFFF",
    },
    violet: {
      fg: "#4B4ABD",
      bg: violet[0],
      border: violet[2],
      emphasis: violet[5], // #5E5CE6
      onEmphasis: "#FFFFFF",
    },
  },
  nav: {
    bg: ink[1], // #F8F8F7 paper
    text: ink[6],
    hoverBg: ink[2],
    hoverText: blue[6],
    activeBg: "#EEF4FC", // System Blue tint
    activeText: blue[6],
    activeShadow: `inset 3px 0 0 0 ${blue[5]}`,
    activeIndicator: blue[5],
    childActiveBg: blue[0],
    childActiveText: blue[7],
    childActiveBorder: blue[5],
  },
  header: {
    bg: "rgba(255, 255, 255, 0.78)", // Apple frosted glass
    border: "#E7E7E3",
    searchBg: ink[1],
  },
  input: {
    bg: "#FFFFFF",
    border: "#D8D8D6", // ink[2] strong border
    borderHover: ink[4],
    placeholder: ink[4],
    focusRing: blue[5],
    focusBorder: blue[5],
  },
  table: {
    bg: "#FFFFFF",
    headerBg: ink[1],
    headerText: ink[8],
    text: ink[9],
    textMuted: ink[5],
    hover: ink[1],
    selected: "#EEF4FC",
    border: "#E7E7E3",
  },
  chip: {
    bg: ink[1],
    text: ink[8],
    border: ink[3],
  },
  shadow: {
    xs: shadowLight.xs,
    sm: shadowLight.sm,
    md: shadowLight.md,
    lg: shadowLight.lg,
    xl: shadowLight.xl,
    "2xl": shadowLight["2xl"],
    cardHover: "0 10px 28px rgba(13, 13, 12, 0.10), 0 24px 54px rgba(0, 102, 204, 0.10)",
  },
  shimmer: {
    from: ink[1],
    mid: ink[2],
  },
  selection: {
    bg: "#EEF4FC",
    text: ink[9],
  },
};

// ═══════════════════════════════════════════════════════════════════
// ── DARK SCHEME — Apple-class pure-black (OT / ICU / night shift)
// ═══════════════════════════════════════════════════════════════════
//
// Apple pure-black canvas (#000) with Apple system-gray panels. Brand
// brightened to blue[3] for AAA on pure black. Cinnabar at cinnabar[3]
// for contrast. Designed for monitor-glare control in OR / ICU and 24/7
// surveillance.

export const darkScheme: SemanticScheme = {
  bg: {
    canvas: inkDark[9], // #000000 — Apple pure black
    default: inkDark[8], // #1C1C1E — raised
    subtle: inkDark[7], // #2C2C2E — softer panels
    muted: inkDark[8],
    emphasis: blue[4], // bright brand fill
    inverse: ink[0],
    overlay: "rgba(0, 0, 0, 0.72)",
  },
  fg: {
    default: inkDark[0], // #F5F5F7
    muted: inkDark[1], // #E5E5EA
    subtle: inkDark[2], // #C7C7CC
    faint: inkDark[3], // #8E8E93
    onEmphasis: "#FFFFFF",
    onAccent: "#FFFFFF",
    onInverse: ink[9],
    link: blue[3],
    linkHover: blue[2],
  },
  border: {
    default: inkDark[7], // #2C2C2E
    muted: inkDark[8], // #1C1C1E
    strong: inkDark[5], // #48484A
    focus: blue[3],
  },
  brand: {
    fg: blue[3], // #4495FF — readable on black
    bg: "rgba(0, 102, 204, 0.16)",
    emphasis: blue[4], // #1A7CFF — AAA on black
    emphasisHover: blue[3],
    emphasisPressed: blue[5],
    muted: "rgba(0, 102, 204, 0.10)",
    onEmphasis: "#FFFFFF",
    tint: "#001F3F",
    tintStrong: blue[8],
    outline: inkDark[6],
  },
  accent: {
    fg: cinnabar[3], // #E9705B
    bg: "rgba(183, 50, 46, 0.20)",
    emphasis: cinnabar[4], // #D44A36
    onEmphasis: "#FFFFFF",
    tint: "rgba(183, 50, 46, 0.12)",
  },
  status: {
    success: {
      fg: mint[3],
      bg: "rgba(28, 183, 133, 0.18)",
      border: mint[6],
      emphasis: mint[4],
      onEmphasis: ink[9],
    },
    warning: {
      fg: "#FFCC66",
      bg: "rgba(255, 159, 10, 0.18)",
      border: amber[6],
      emphasis: amber[5],
      onEmphasis: ink[9],
    },
    danger: {
      fg: "#FF6961",
      bg: "rgba(255, 69, 58, 0.20)",
      border: rose[6],
      emphasis: rose[5],
      onEmphasis: "#FFFFFF",
    },
    info: {
      fg: "#64B5FF",
      bg: "rgba(10, 132, 255, 0.20)",
      border: sky[6],
      emphasis: sky[5],
      onEmphasis: ink[9],
    },
    neutral: {
      fg: inkDark[1],
      bg: inkDark[7],
      border: inkDark[5],
      emphasis: inkDark[3],
      onEmphasis: ink[9],
    },
    orange: {
      fg: "#FDBA74",
      bg: "rgba(249, 115, 22, 0.18)",
      border: ochre[6],
      emphasis: ochre[4],
      onEmphasis: ink[9],
    },
    violet: {
      fg: violet[3],
      bg: "rgba(94, 92, 230, 0.20)",
      border: violet[6],
      emphasis: violet[4],
      onEmphasis: ink[9],
    },
  },
  nav: {
    bg: inkDark[9], // pure black
    text: inkDark[1],
    hoverBg: inkDark[7],
    hoverText: inkDark[0],
    activeBg: inkDark[6],
    activeText: blue[2],
    activeShadow: `inset 3px 0 0 0 ${blue[3]}`,
    activeIndicator: blue[3],
    childActiveBg: inkDark[7],
    childActiveText: blue[2],
    childActiveBorder: blue[4],
  },
  header: {
    bg: "rgba(0, 0, 0, 0.78)", // Apple frosted-dark
    border: inkDark[7],
    searchBg: inkDark[8],
  },
  input: {
    bg: inkDark[8],
    border: inkDark[6],
    borderHover: inkDark[5],
    placeholder: inkDark[3],
    focusRing: blue[3],
    focusBorder: blue[4],
  },
  table: {
    bg: inkDark[8],
    headerBg: inkDark[7],
    headerText: inkDark[0],
    text: inkDark[0],
    textMuted: inkDark[2],
    hover: inkDark[6],
    selected: "rgba(0, 102, 204, 0.14)",
    border: inkDark[7],
  },
  chip: {
    bg: inkDark[7],
    text: inkDark[1],
    border: inkDark[5],
  },
  shadow: {
    xs: shadowDark.xs,
    sm: shadowDark.sm,
    md: shadowDark.md,
    lg: shadowDark.lg,
    xl: shadowDark.xl,
    "2xl": shadowDark["2xl"],
    cardHover: "0 10px 28px rgba(0, 0, 0, 0.50), 0 24px 54px rgba(0, 102, 204, 0.14)",
  },
  shimmer: {
    from: inkDark[7],
    mid: inkDark[6],
  },
  selection: {
    bg: "rgba(0, 102, 204, 0.32)",
    text: "#FFFFFF",
  },
};

// ═══════════════════════════════════════════════════════════════════
// ── Scheme Registry
// ═══════════════════════════════════════════════════════════════════

export const schemes = {
  light: lightScheme,
  dark: darkScheme,
} as const;

export type SchemeName = keyof typeof schemes;

export const sharedReferences = {
  indicators: {
    primary: mint[4],
    teal: mint[5],
    success: mint[5],
    warning: amber[5],
    danger: rose[5],
    info: sky[5],
    violet: violet[5],
    orange: ochre[5],
    slate: slate[4],
  },
} as const;
