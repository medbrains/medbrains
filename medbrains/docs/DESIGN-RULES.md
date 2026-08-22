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
| [DEVICE-SURFACE-DESIGN-RULES.md](./DEVICE-SURFACE-DESIGN-RULES.md) | **Right design system per surface** — web=Carbon 2x-grid; mobile=Carbon-for-RN/Material+44px targets; TV=10-foot UI (D-pad focus, overscan 48/27dp, light-on-dark); kiosk=touch; IoT=minimal. Carbon brand tokens layered on every surface, never the web grid forced onto TV/mobile |
| [MOBILE-FORM-KEYBOARD-RULES.md](./MOBILE-FORM-KEYBOARD-RULES.md) | **Power of Ten for forms** — keyboard per input type, visible labels (overrides Apple's placeholder-as-label), return-key traversal and where it cannot work (numeric has no return key, multi-line owns it), navigator bar, keyboard never covering the submit, validate-on-submit + never disable on validity, 44/48/64 targets, immediate feedback, save-and-add-next, never lose what was typed |
| [PLATFORM-ACCESSIBILITY-RULES.md](./PLATFORM-ACCESSIBILITY-RULES.md) | **Power of Ten for native a11y** — iOS/Android/Android TV/webOS: names that say what they do, unique labels in lists, announced state, platform target floors, D-pad focus never trapped, Dynamic Type / fontScale, measured contrast, no auto-play, character-by-character TV entry, and the **no-look test** |

Existing companions: [UI_GUIDELINES.md](./UI_GUIDELINES.md),
[ACCESSIBILITY.md](./ACCESSIBILITY.md), [ui-plan-before-build.md](./ui-plan-before-build.md).

The IBM Design Language + WCAG 2.2 are now covered. (Deep dives like a full 2x-grid
spec or data-viz component recipes can be added if a screen needs them.)
