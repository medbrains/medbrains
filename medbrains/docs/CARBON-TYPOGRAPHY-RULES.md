# Carbon Typography Rules (MedBrains)

Actionable extraction of IBM Carbon typography
(https://www.ibm.com/design/language/typography/). Type is **IBM Plex**, sized for
clinical density. Use theme type tokens / Mantine sizes — **never literal px** for
type.

## Typefaces

- **IBM Plex Sans** — all UI (body, labels, inputs, tables, nav, buttons).
- **IBM Plex Mono** — code, UHIDs, timestamps, eyebrow/metadata labels.
- **IBM Plex Serif** — sparingly, editorial/display only (rare in MedBrains).
- Don't introduce other fonts. Variable-font weights from the installed Plex.

## Type scale (Carbon set → use tokens, not px)

| Role | Size/LH | Use |
|---|---|---|
| caption-01 | 12 / 16 | timestamps, captions |
| label-01 | 12 / 16 | input labels, eyebrows (mono, tracked) |
| body-01 | **14 / 20** | **default body (clinical density)** |
| body-02 | 16 / 24 | comfortable reading / marketing |
| heading-01..04 | 14→28 | section + page headings |
| heading-05..07 / fluid | 32→ | feature/expressive headings only |

- **Productive (default):** 14px body, tight, dense — the app baseline.
- **Expressive:** larger fluid headings for marketing/empty states only.

## Weights & hierarchy

- Weights: **light 300 / regular 400 / semibold 600**. Headings = semibold;
  body = regular; emphasis = semibold (not bold-700 walls).
- Build hierarchy with **size + weight + colour token**, not random px. Don't skip
  heading levels semantically (one `<h1>`/page; `<h2..h6>` in order).
- Eyebrow/metadata labels: Plex **Mono**, ~11–12px, uppercase, ~0.08–0.14em
  letter-spacing.

## Readability & a11y

- **Line length ~40–75ch** for body; constrain wide containers.
- **Left-aligned** (no justified text); preserve paragraph spacing.
- **Resizable to 200%** + survive increased text spacing (WCAG 1.4.4/1.4.12) —
  never fixed-height text boxes that clip.
- **Don't convey meaning by typeface/weight alone**; pair with text/structure.
- Respect locale (i18n) — never hardcode text; type must handle longer
  translations + RTL gracefully.

## Applied

- Use Mantine `size`/`fw` + theme tokens (`fontSize`, `fontWeight`, `lineHeight`
  from the design-system theme). Tables/forms = body-01 (14). Page title = a single
  `<h1>`. Metadata (UHID/time) = Plex Mono token.
