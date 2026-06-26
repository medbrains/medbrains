# Carbon Data Visualization Rules (MedBrains)

Actionable extraction of IBM Carbon data visualization
(https://www.ibm.com/design/language/data-visualization/ overview + charts +
design/basics + infographics/infograms). In a clinical system a misleading chart
is a **patient-safety risk** — accuracy and clarity are non-negotiable.

## Pick the right chart for the question

| Question | Chart |
|---|---|
| Compare categories | Bar / grouped bar |
| Trend over time | Line / area |
| Part-to-whole | Stacked bar (preferred); donut **sparingly**, ≤5 slices |
| Distribution | Histogram / box plot |
| Correlation | Scatter |
| Single KPI | Big number + tiny sparkline |

- **Avoid pie/donut for >5 categories, and avoid 3D entirely.** Don't use a chart
  where a number or table is clearer.

## Honesty (clinical-critical)

- **Bar/area baselines start at 0.** Never truncate a value axis to exaggerate.
- **Linear, labelled scales** with units; mark reference ranges + critical
  thresholds on clinical charts (vitals, labs) so abnormal reads at a glance.
- No dual y-axes that imply false correlation; no smoothing that hides spikes.
- Show data provenance/time window; don't plot stale data without a timestamp.

## Clarity (data-ink)

- Maximize data-ink: drop chartjunk, heavy gridlines, redundant legends. Direct-
  label series where possible instead of a distant legend.
- Clear **title, axis labels, units, legend**; one focal message per chart.
- Don't overplot — aggregate, sample, or facet dense data.

## Colour (Carbon palettes)

- Use the Carbon categorical / sequential / diverging palettes (via `@carbon/charts`
  tokens), **not** ad-hoc hex. Sequential for magnitude, diverging for +/- around a
  midpoint, categorical for discrete series.
- **Colour-blind safe** + **never colour alone** — pair with labels, patterns, or
  shape (WCAG 1.4.1). Series text/marks ≥ **3:1** non-text contrast (1.4.11).
- Reserve the emergency-code + danger colours for genuine alerts only.

## Accessibility (WCAG 2.2)

- Provide a **text/data-table alternative** (or `aria-label`/summary) for every
  chart; keyboard-navigable data points where interactive.
- Tooltips dismissible/persistent (1.4.13); focus-visible on interactive marks.
- Don't convey meaning by colour alone; include direct labels.

## Infographics / infograms

- Combine data + short narrative; stay **on the 2x grid**, system type + icon set,
  monochrome-plus-one-accent. Each stat traces to a real, cited source.
- Don't distort proportions for drama (pictograms must scale by area honestly).

## Applied

- Use `@carbon/charts` (or the existing chart components) — don't hand-roll SVG
  charts. Drive colour from tokens. Dashboard KPIs = number-first with a small
  trend; reserve full charts for analysis screens.
