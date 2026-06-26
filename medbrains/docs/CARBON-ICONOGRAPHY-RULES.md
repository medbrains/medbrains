# Carbon Iconography Rules (MedBrains)

Actionable extraction of IBM Carbon iconography
(https://www.ibm.com/design/language/iconography/overview). Icons in a clinical
system are functional wayfinding, not decoration — they must be consistent,
legible, and accessible. Pairs with `docs/UI_GUIDELINES.md` + the WCAG rules.

## Source & family

- **One icon family, used consistently** — `@tabler/icons-react` is the app
  standard (Carbon-aligned line style). Don't mix tabler + lucide + ad-hoc SVG in
  the same surface. (`lucide-react` exists in a few legacy spots; new code = tabler.)
- **Never inline raw `<svg>`/`<path>`** in TSX (project hard rule). Tabler
  component, or a committed `.svg` in `assets/` imported via `?react`.
- **No letter-abbreviation "icons"** as the primary mark in navigation — use a
  real glyph (this was the #3479 fix). Abbr badges are allowed only as a labelled
  identity mark in page headers, never as a substitute for a nav icon.

## UI icons vs App icons (Carbon distinguishes them)

Carbon has two libraries — use the right one:

- **UI icons** (https://www.ibm.com/design/language/iconography/ui-icons/library) —
  functional, **monochrome line** icons inside the interface: nav, buttons, status,
  inputs, table actions. Single colour (currentColor), 16/20/24/32px, ~2px stroke.
  **This is 99% of MedBrains icons → `@tabler/icons-react`.** One concept = one UI
  icon, reused via `ICON_MAP`.
- **App / product icons**
  (https://www.ibm.com/design/language/iconography/app-icons/library) — larger,
  **more detailed, may use a brand accent colour**, represent a product/module/
  launcher tile (not an in-UI control). In MedBrains these are the **brand mark**
  (`/logo/medbrains-mark.svg`) and the per-module identity marks. Rules: keep them
  on their own grid, don't drop them inline as UI icons, and don't restyle them
  with `currentColor` (they carry their own brand colour). A UI control never uses
  an app icon and vice-versa.

## Grid & size

- Icons sit on the Carbon icon grid. Standard sizes (px, on the 8px system):
  **16** (inline/dense), **20** (default UI control), **24** (touch target min),
  **32** (feature/empty-state). Pick from this set — no arbitrary sizes.
- **Stroke weight ~1.5–2px**, consistent across an icon set; don't scale a 16px
  icon up to 32 (stroke distorts) — use the size-appropriate glyph.
- **Optical alignment** over mathematical — center icons to their label's cap
  height, nudge for visual balance.

## Colour

- **Monochrome, single colour, from tokens** — icons inherit `currentColor` /
  `--mb-icon` / the semantic `tone`. Never hardcode hex or apply gradients/multi-
  colour (the only exceptions: the brand mark + emergency-code colours).
- State colour comes from the parent control's state (hover/active/disabled), not
  a per-icon override.

## Meaning & pairing

- Icons are **functional** — each must communicate or reinforce an action/object.
- **Pair with a text label** wherever meaning isn't universally obvious; icon-only
  is reserved for well-established glyphs (search, close, edit, delete, menu).
- **Consistent metaphor** — the same concept uses the same icon everywhere (one
  "edit", one "delete", one "patient"). Maintain the module→icon map in
  `config/navigation.ts` (`ICON_MAP`); reuse it, don't invent per-screen.
- Don't overload a screen with icons — they lose meaning. Use them at decision
  points, not on every row/field.

## Accessibility (WCAG 2.2)

- **Icon-only control → `aria-label`** (the control's purpose). Tabler icons take
  `aria-hidden` by default inside a labelled control.
- **Decorative icon → `aria-hidden="true"`** so it isn't announced.
- **Non-text contrast ≥ 3:1** for meaningful icons (SC 1.4.11).
- **Don't rely on icon/colour alone** for status — add text/shape (SC 1.4.1).
- Icon-button hit area ≥ **24×24px** (SC 2.5.8) even if the glyph is 16/20px.

## Tips (applied)

- Resolve nav icons through `resolveIcon`/`ICON_MAP` — one registry, all mapped.
- Prefer outline (line) icons for UI; filled only for selected/active emphasis.
- Keep icon + label spacing on the 8px grid (`gap` token), vertically centered.
