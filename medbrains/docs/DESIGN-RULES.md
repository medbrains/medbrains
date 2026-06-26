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

Existing companions: [UI_GUIDELINES.md](./UI_GUIDELINES.md),
[ACCESSIBILITY.md](./ACCESSIBILITY.md), [ui-plan-before-build.md](./ui-plan-before-build.md).

## Not yet extracted (add on request)

IBM Design Language topics not yet turned into rule docs: **colour**, **typography**
(IBM Plex scale/tokens — partly in the theme), **2x-grid deep-dive**, **voice &
tone / content**, **inclusive/accessible content**. The theme tokens already encode
colour + type; a doc can formalize the usage rules when needed.
