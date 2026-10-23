# Colour Rules (MedBrains)

The palette is a Material-3 colour system seeded on our brand blue **#0F62FE**
(decided 2026-10-23: keep the blue, fix the system around it). Figma and code
share one source: `packages/design-system/src/theme/figma-varspec.json`, the spec
the Figma library's variables were built from. `pnpm --filter
@medbrains/design-system gen:colors` turns it into `colors.generated.ts`.
**Always use theme tokens (`--mb-*`), never raw hex** in components or SCSS.

## Structure

- **Ramps** (Figma "Primitives"): 13-tone Blue, Purple, Neutral, Green, Amber,
  Red, plus Surface tones. Never used directly; roles alias them.
- **Roles** per scheme (Figma "Color" / "Color Dark"): the same names in light
  and dark, only the values differ. Web name = Figma code syntax:
  - surfaces: `--mb-surface`, `--mb-surface-container-{lowest,low,high,highest}`,
    `--mb-surface-container`, `--mb-surface-variant`, `--mb-inverse-surface`
  - content: `--mb-on-surface`, `--mb-on-surface-variant`, `--mb-inverse-on-surface`
  - lines: `--mb-outline` (inputs, ≥3:1), `--mb-outline-variant` (hairlines)
  - families: `--mb-{primary,tertiary,success,warning,error}`, each with
    `-container`, `--mb-on-…` and `--mb-on-…-container`
  - state layers: `--mb-state-{role}-{4,8,12,38}` (hover 8, pressed/selected 12,
    disabled 38)
  - clinical: `--mb-clinical-{critical,high,low,normal}` + `--mb-clinical-on-…`
  - emergency: `--mb-emergency-{blue,red,pink,black,yellow,orange}`,
    `--mb-emergency-on-dark` / `-on-light`
- The older `--mb-*` names (`--mb-text-primary`, `--mb-brand-emphasis`,
  `--mb-danger-bg`, …) still resolve: `semantic.ts` maps them onto the roles.
  Prefer the role names in new code.

## Rules

- **Blue = brand, primary actions, focus, selection.** One filled primary action
  per view. Brand gradients are blue only.
- **Purple (tertiary) is the secondary accent**: AI and the mascot, the logo
  heart, badges, icons, chips, small highlights, and buttons such as "Ask AI".
  Never a full-width alert banner or a page background: those belong to the
  emergency layer.
- **Brand purple `--mb-brand-purple`** (Figma `tertiary/tertiaryBrand`), the
  purple counterpart of brand blue #0F62FE: **#851B7F** in light (white text
  8.5:1, safe at every size) and Purple 80 **#FFABF0** in dark (with
  `--mb-on-tertiary` text). Text in purple on a surface uses `--mb-tertiary`
  (Purple 40 #9A3293 light, Purple 80 dark). `theme-contrast.spec.ts` checks
  these pairs at 4.5:1 in both schemes.
- **Green / amber / red only for clinical meaning**, always with an icon or a
  word (WCAG 1.4.1). Low and high abnormal are both amber; the arrow and the
  word tell them apart. Critical is red.
- **Emergency codes are fixed**: identical on every deployment and in both
  schemes; never reuse those hues for UI. White text on blue/red/black, dark
  text (`--mb-emergency-on-light`) on pink, yellow and orange.
- **Text on a fill uses that fill's on-colour** (`--mb-on-primary`, …), never a
  literal white: in the dark scheme the filled roles are light.
- **Contrast (WCAG 2.2 AA):** body text ≥ 4.5:1, large text/UI/icons ≥ 3:1, in
  both schemes. `e2e/accessibility/theme-contrast.spec.ts` sweeps the key
  screens in each.
- **Light and dark** both ship; the app defaults to dark with a header switcher.
- **New colour need → add a role to the Figma spec and regenerate**, never an
  inline value. SCSS is layout only.
