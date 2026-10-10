/**
 * The figures a ticker shows under a line: where it is now, where it was,
 * and its range — over the known points only. A day with no reading is a
 * gap, not a zero, so it never drags the average down or reads as the low.
 */
export interface SeriesStats {
  latest: number | null;
  previous: number | null;
  /** Latest minus previous; null when either is unknown. */
  change: number | null;
  /** Change as a share of the previous value; null when that is 0 or unknown. */
  changePct: number | null;
  total: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** How many points were known. */
  count: number;
}

export function seriesStats(values: (number | null | undefined)[]): SeriesStats {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const latest = known.at(-1) ?? null;
  const previous = known.at(-2) ?? null;
  const change = latest !== null && previous !== null ? latest - previous : null;
  const total = known.reduce((sum, v) => sum + v, 0);
  return {
    latest,
    previous,
    change,
    changePct: change !== null && previous ? (change / Math.abs(previous)) * 100 : null,
    total,
    average: known.length ? total / known.length : null,
    min: known.length ? Math.min(...known) : null,
    max: known.length ? Math.max(...known) : null,
    count: known.length,
  };
}

/** The numbers out of a chart's rows: the `key` column, as numbers where it is one. */
export function columnValues(rows: Record<string, unknown>[], key: string): (number | null)[] {
  return rows.map((row) => {
    const n = typeof row[key] === "number" ? (row[key] as number) : Number(row[key]);
    return row[key] === null || row[key] === undefined || Number.isNaN(n) ? null : n;
  });
}
