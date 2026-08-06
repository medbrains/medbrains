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

- Use the Carbon categorical / sequential / diverging palettes (from the
  `@medbrains/design-system` tokens), **not** ad-hoc hex. Sequential for magnitude,
  diverging for +/- around a midpoint, categorical for discrete series.
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

## Applied — which chart library

Carbon is the **palette and the layout language here, not the chart renderer**.
`@carbon/charts` is not installed and we are not adopting it: porting the ~38
files already on `@mantine/charts` would buy documentation compliance and nothing
a user can see. Decision taken 2026-08-06.

Two libraries, with a real division of labour — check this before adding a third:

| Use | Library | Why |
|---|---|---|
| Line, bar, area, donut, sparkline — dashboards, KPI cards, module screens | **`@mantine/charts`** | Already the stack in ~38 files; matches the Mantine seam the rest of the UI is built from |
| Heatmap, sankey, treemap, gauge, boxplot, radar, graph — the analytical `VisualKind`s in the report catalog | **`echarts`** | `@mantine/charts` has no such marks. Confined to the reports module (`ReportChart.tsx`, `chart-options.ts`) |

`recharts` appears in `package.json` but is **not** ours to call directly — it is
the peer dependency `@mantine/charts` renders through. Do not import it, and do
not "clean it up": removing it breaks every Mantine chart.

Whichever library: don't hand-roll SVG charts, drive colour from the design-system
tokens (never library defaults, never raw hex), and keep the accessibility rules
above — they are library-independent. Dashboard KPIs = number-first with a small
trend; reserve full charts for analysis screens.
