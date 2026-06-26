# Carbon Colour Rules (MedBrains)

Actionable extraction of IBM Carbon colour
(https://www.ibm.com/design/language/color/). MedBrains' palette is Carbon —
**always use semantic theme tokens (`--mb-*`), never raw hex** in components.

## Token layers (never raw values)

- **Semantic, not literal.** Use role tokens, not hue/step: `--mb-text-primary`,
  `--mb-text-secondary`, `--mb-text-helper`, `--mb-text-placeholder`,
  `--mb-interactive`/`--mb-brand`, `--mb-border`/`--mb-border-strong`,
  `--mb-input-*`. SCSS is layout-only — colour comes from the theme.
- **Surface elevation via layer tokens** — background → layer-01 → layer-02 →
  layer-03 (`--mb-canvas`/`--mb-panel`/card tokens). Don't fake elevation with
  arbitrary grays or heavy shadows; flat Carbon surfaces + 1px hairline borders.

## Palette structure (Carbon)

- **Interactive/brand:** Blue 60 `#0f62fe` (`--mb-brand`/`--mb-interactive`).
- **Neutrals:** Gray 10–100 ramp for text/surfaces/borders; pick the step the
  token maps to, not a hand-picked gray.
- **Support (status) colours — semantic only:** error/red, success/green,
  warning/yellow, info/blue (`--mb-danger-*`, `--mb-success-*`, `--mb-warning-*`).
  Reserve for genuine status, never decoration.
- **Emergency codes are FIXED** (blue/red/pink/black/yellow/orange) — identical on
  every deployment regardless of theme; never reuse those hues for UI.

## Usage rules

- **Contrast (WCAG 1.4.3/1.4.11):** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1.
  Use `--mb-text-secondary` for body, not `--mb-text-muted` (which is for hints).
- **Never colour alone for meaning** (WCAG 1.4.1) — pair with icon/text/shape.
- **Light theme only** (`forceColorScheme="light"`); don't add dark-mode branches.
- **One accent discipline:** the brand/interactive blue carries actions + focus;
  don't sprinkle multiple accent hues. Status colours appear only on status.
- **Per-component colour lives in the theme**, not SCSS and not inline hex — the
  theme is the single source of truth. New colour need → add/extend a token.

## Applied

- Buttons/links/focus → interactive token. Inputs → `--mb-input-*`. Cards → layer
  + `--mb-border`. Charts → Carbon palette tokens (see data-viz rules). Brand mark
  + emergency codes keep their own fixed colour (app-icon exception).
