# Carbon Layout Rules (MedBrains)

Actionable extraction of IBM Carbon layout
(https://www.ibm.com/design/language/layout/overview +
/layout/tips-and-techniques). MedBrains' design system is Carbon — these are the
spacing/grid rules every screen follows. Pairs with `docs/UI_GUIDELINES.md`.

## The 2x Grid

- **Mini-unit = 8px.** All sizing/spacing is a multiple of 8 (with 4px allowed for
  fine adjustments inside dense components). Never arbitrary px.
- **Columns:** 16-column fluid grid. Use Mantine `Grid`/`SimpleGrid` — don't
  hand-roll column math.
- **Gutters:** 32px default (can narrow to 16px in dense/data regions).
- **Margins:** scale with breakpoint; content gets breathing room, not edge-to-edge.

## Spacing scale (use tokens, not raw px)

Carbon spacing tokens (`$spacing-01..13`): 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80,
96, 160px. In MedBrains use the theme `space.*` tokens / Mantine `xs sm md lg xl`
gaps — **never literal px** in layout. Inside a component, step the scale (8→16→24)
rather than inventing values.

## Breakpoints (Carbon)

| Name | Min width | Columns |
|---|---|---|
| sm  | 320px  | 4  |
| md  | 672px  | 8  |
| lg  | 1056px | 16 |
| xl  | 1312px | 16 |
| max | 1584px | 16 |

- Design mobile-first; reflow to a single column at `sm` (WCAG 1.4.10).
- Use Mantine responsive props (`cols={{ base: 1, sm: 2, lg: 3 }}`), not media
  queries in component SCSS.

## Layout rules

- **Sharp corners (radius 0–2px).** No rounded cards/inputs. (Theme enforces it.)
- **Hairline borders 1px** (`--mb-border`), flat surfaces — no heavy shadows
  except the design-system elevation tokens.
- **Align to the grid:** every block starts/ends on an 8px line. Optical alignment
  beats mathematical when they disagree (Carbon tip).
- **White space is structure**, not decoration — group related items with tighter
  spacing, separate groups with a step up the scale (proximity).
- **Consistent regions:** page = header → content; use landmark regions
  (`<main>`, `<nav>`, `<header>`) for both layout and a11y.
- **Aspect ratios** for media/thumbnails come from the Carbon ratio set
  (1:1, 4:3, 16:9, 2:1, 2:3) — keep media on-grid.
- **Density:** clinical screens are dense. Prefer the `sm`/compact component sizes;
  reserve generous spacing for marketing/empty states.

## Tips & techniques (applied)

- Build layout with **Mantine layout primitives** (`Box/Stack/Group/SimpleGrid/
  Grid/Flex`), never raw `<div>` (project hard rule).
- Keep SCSS **layout-only**; colour/typography come from theme tokens.
- One spacing rhythm per view — don't mix 5 different gaps; pick 2–3 steps.
- Containers have a max content width on `xl`/`max` so line length stays readable
  (~66ch for body text).
