/**
 * A report's rows as a chart reads them: one value per point along the
 * bottom, per series. Reports often hold several rows for one date — one per
 * department, ward or doctor — and repeating the date on the axis reads as
 * noise. Those rows are either split into a series each (when another column
 * names a handful of groups) or combined into the point: counts add up,
 * rates and durations average, because thirty minutes and forty minutes are
 * not seventy minutes.
 */

export interface ReportSeries {
  x: string[];
  series: { name: string; values: (number | null)[] }[];
  /** The bottom axis is dates, so the chart is a line. */
  isTrend: boolean;
}

const ID_COLUMN = /(^id$|_id$)/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const AVERAGE_LIKE =
  /(pct|percent|rate|avg|average|mean|median|minutes|hours|days|tat|score|ratio)/i;
const MAX_SERIES = 3;
/** Past this many groups a split stops reading; the rows are combined instead. */
const MAX_GROUPS = 8;
/** A bar per category stops reading past this many; the table has the rest. */
const MAX_BARS = 20;

type Row = Record<string, unknown>;

export const humanise = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function combine(column: string, values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((s, v) => s + v, 0);
  return AVERAGE_LIKE.test(column) ? total / values.length : total;
}

export function reportSeries(rows: Row[]): ReportSeries | null {
  const keys = Object.keys(rows[0] ?? {}).filter((k) => !ID_COLUMN.test(k));
  const numeric = keys.filter(
    (k) => rows.some((r) => isNum(r[k])) && rows.every((r) => r[k] == null || isNum(r[k])),
  );
  if (numeric.length === 0) return null;
  const text = keys.filter(
    (k) => !numeric.includes(k) && rows.every((r) => r[k] == null || typeof r[k] === "string"),
  );
  const category = text[0];
  if (!category) {
    const shown = rows.slice(0, MAX_BARS);
    return {
      x: shown.map((_, i) => String(i + 1)),
      series: numeric.slice(0, MAX_SERIES).map((k) => ({
        name: humanise(k),
        values: shown.map((r) => (isNum(r[k]) ? r[k] : null)),
      })),
      isTrend: false,
    };
  }
  const label = (r: Row) => String(r[category] ?? "—");
  const isTrend = ISO_DATE.test(label(rows[0] ?? {}));
  let x = [...new Set(rows.map(label))];
  if (isTrend) x.sort();
  else x = x.slice(0, MAX_BARS);

  const at = new Map<string, Row[]>();
  for (const r of rows) at.set(label(r), [...(at.get(label(r)) ?? []), r]);
  const point = (column: string, members: Row[] = []) =>
    combine(column, members.map((r) => r[column]).filter(isNum));

  const repeats = x.length < rows.length;
  const group = repeats
    ? text.slice(1).find((k) => {
        const n = new Set(rows.map((r) => r[k])).size;
        return n > 1 && n <= MAX_GROUPS;
      })
    : undefined;
  if (group) {
    const measure = numeric[0] as string;
    const groups = [...new Set(rows.map((r) => String(r[group] ?? "—")))];
    return {
      x,
      series: groups.map((g) => ({
        name: g,
        values: x.map((xv) =>
          point(
            measure,
            at.get(xv)?.filter((r) => String(r[group] ?? "—") === g),
          ),
        ),
      })),
      isTrend,
    };
  }
  return {
    x,
    series: numeric
      .slice(0, MAX_SERIES)
      .map((k) => ({ name: humanise(k), values: x.map((xv) => point(k, at.get(xv))) })),
    isTrend,
  };
}
