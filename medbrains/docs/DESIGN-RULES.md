# MedBrains Design Rules — Index

The project's design system is **IBM Carbon** with **WCAG 2.2 AA** accessibility
(patient-safety requirement). These docs extract the IBM Design Language +
WCAG 2.2 into actionable, enforceable project rules. They are **law** — referenced
from `CLAUDE.md`; every UI PR must comply.

## Rule docs

| Doc | Covers |
|---|---|
| [WCAG-2.2-RULES.md](./WCAG-2.2-RULES.md) | Accessibility — all A/AA SC incl. the 9 new 2.2 criteria (focus appearance, target size, accessible auth, redundant entry, consistent help, dragging, focus-not-obscured) |
| [CARBON-LAYOUT-RULES.md](./CARBON-LAYOUT-RULES.md) | 2x grid, 8px mini-unit, breakpoints, spacing tokens, sharp corners |
| [CARBON-MOTION-RULES.md](./CARBON-MOTION-RULES.md) | Productive vs expressive, duration/easing tokens, ≤240ms feedback, reduced-motion, pausable auto-play |
| [CARBON-ICONOGRAPHY-RULES.md](./CARBON-ICONOGRAPHY-RULES.md) | One family (tabler), sizes 16/20/24/32, monochrome, UI-icons vs app-icons, real glyphs not letter-badges, a11y |
| [CARBON-PHOTOGRAPHY-RULES.md](./CARBON-PHOTOGRAPHY-RULES.md) | Authentic/human/dignified imagery, patient privacy (no identifiable patients/PHI), scrim behind text, a11y |
| [CARBON-DATAVIZ-RULES.md](./CARBON-DATAVIZ-RULES.md) | Right chart per question, honest scales + clinical reference ranges, Carbon palettes, colour-blind-safe, text/data-table alt |
| [CARBON-COLOR-RULES.md](./CARBON-COLOR-RULES.md) | Semantic `--mb-*` tokens (never raw hex), layer/elevation, support + emergency colours, contrast, never colour-alone |
| [CARBON-TYPOGRAPHY-RULES.md](./CARBON-TYPOGRAPHY-RULES.md) | IBM Plex, type scale (14px body / clinical density), weights, hierarchy, readability + a11y |
| [CARBON-CONTENT-RULES.md](./CARBON-CONTENT-RULES.md) | Voice & tone, sentence case, error messages, clinical accuracy, inclusive/accessible content, i18n |
| [DEVICE-CONSTRAINED-RULES.md](./DEVICE-CONSTRAINED-RULES.md) | **Low-end device "Power of Ten"** — TV/kiosk/mobile/IoT/edge: bound everything, zero leaks, virtualize lists, memory budgets, fail-safe, share-don't-copy |

Existing companions: [UI_GUIDELINES.md](./UI_GUIDELINES.md),
[ACCESSIBILITY.md](./ACCESSIBILITY.md), [ui-plan-before-build.md](./ui-plan-before-build.md).

The IBM Design Language + WCAG 2.2 are now covered. (Deep dives like a full 2x-grid
spec or data-viz component recipes can be added if a screen needs them.)
