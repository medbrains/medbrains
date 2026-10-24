# Colour Rules (MedBrains)

**The app uses the website's theme** (founder decision 2026-10-24): the
colours of `website/src/styles/global.scss` (paper/ink in light, night navy in
dark, blue **#0F62FE**, pulse green **#42BE65**) laid onto Material-3 roles, with
purple **#851B7F** only as the AI accent. Figma and code
share one source: `packages/design-system/src/theme/figma-varspec.json`, the spec
the Figma library's variables were built from. `pnpm --filter
@medbrains/design-system gen:colors` turns it into `colors.generated.ts`.
**Always use theme tokens (`--mb-*`), never raw hex** in components or SCSS.

## Structure

- **Ramps** (Figma "Primitives"): `Site/*` holds the website tokens (paper,
  ink, night, blue, sky, pulse, purple…); the Green/Amber/Red ramps carry the
  clinical families. Never used directly; roles alias them.
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

- **Blue #0F62FE = brand, primary actions, active, selection.** It is the
  exact fill in both schemes, with white text (5:1). Blue as small text uses
  `--mb-primary-text` (blue-deep #0043CE on paper, sky #78A9FF on night), as
  do links, the active nav label and the focus ring. Brand gradients are blue
  only. One filled primary action per view.
- **Purple #851B7F = AI only** (`--mb-brand-purple`, Figma
  `tertiary/tertiaryBrand`): AI buttons, AI labels, the orb and the mascot's
  accents, the same fill in both schemes with white text (8.5:1). Purple as text
  uses `--mb-tertiary` (#851B7F on paper, #FFABF0 on night). Never a banner or a
  page background.
- **Pulse green #42BE65 (`--mb-pulse`)**: the live dot, the logo beat and the
  ECG beacon, as on the website. Success text and containers stay in the
  accessible green family.
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
