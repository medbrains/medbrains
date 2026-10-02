/**
 * A management KPI reading (`management_kpis.rs`): the day's value, three
 * baselines and the daily series. This turns it into the words a tile shows —
 * "18 more than a usual Friday" — and whether that is good, bad or neither.
 *
 * Colour follows the KPI's own sense of better, never the arrow: wait time
 * going up is bad, visits going up is neither.
 */

export type KpiBaseline = "weekday" | "yesterday" | "week";
export type KpiTone = "good" | "bad" | "neutral";

export interface KpiReading {
  value: number | null;
  unit: string;
  better: "lower" | "higher" | "neutral";
  as_of: string;
  so_far: boolean;
  baselines: Record<KpiBaseline, number | null>;
  series: { date: string; value: number | null }[];
}

export interface KpiComparison {
  text: string;
  tone: KpiTone;
  direction: "up" | "down" | "flat";
}

export function isKpiReading(data: unknown): data is KpiReading {
  return (
    typeof data === "object" &&
    data !== null &&
    "baselines" in data &&
    "series" in data &&
    "better" in data
  );
}

const DECIMALS: Record<string, number> = { min: 1, h: 1, "%": 1, visits: 0 };

function round(n: number, unit: string): number {
  const f = 10 ** (DECIMALS[unit] ?? 1);
  return Math.round(n * f) / f;
}

/** The value as the tile prints it: "42", "12.5 min", "3.2 h", "8.3%", or "—" when unknown. */
export function formatKpi(value: number | null, unit: string): string {
  if (value === null) return "—";
  const n = new Intl.NumberFormat(undefined, { maximumFractionDigits: DECIMALS[unit] ?? 1 }).format(
    round(value, unit),
  );
  if (unit === "%") return `${n}%`;
  if (unit === "min") return `${n} min`;
  if (unit === "h") return `${n} h`;
  return n;
}

const WORDS: Record<string, [up: string, down: string]> = {
  visits: ["more", "fewer"],
  min: ["longer", "shorter"],
  h: ["longer", "shorter"],
  "%": ["pts higher", "pts lower"],
};

function weekdayName(isoDate: string): string {
  // A date-time without a zone parses as local time, so the day stays the day.
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
}

/** What the day is set against: "a usual Friday by this time", "yesterday"… */
function baselinePhrase(reading: KpiReading, baseline: KpiBaseline): string {
  const byNow = reading.so_far ? " by this time" : "";
  if (baseline === "weekday") return `a usual ${weekdayName(reading.as_of)}${byNow}`;
  if (baseline === "yesterday") return `yesterday${byNow}`;
  return `the last 7 days${byNow}`;
}

/** The comparison line for the chosen baseline, or null when there is none to make. */
export function compareKpi(reading: KpiReading, baseline: KpiBaseline): KpiComparison | null {
  const base = reading.baselines[baseline];
  if (reading.value === null || base === null) return null;
  const phrase = baselinePhrase(reading, baseline);
  const delta = round(reading.value - base, reading.unit);
  if (delta === 0) return { text: `Same as ${phrase}`, tone: "neutral", direction: "flat" };
  const [up, down] = WORDS[reading.unit] ?? ["higher", "lower"];
  // "18 more", "4.2 min longer", "3.1 pts higher" — the unit word carries the %.
  const size = formatKpi(Math.abs(delta), reading.unit === "%" ? "" : reading.unit);
  const improving = reading.better === "lower" ? delta < 0 : delta > 0;
  return {
    text: `${size} ${delta > 0 ? up : down} than ${phrase}`,
    tone: reading.better === "neutral" ? "neutral" : improving ? "good" : "bad",
    direction: delta > 0 ? "up" : "down",
  };
}
