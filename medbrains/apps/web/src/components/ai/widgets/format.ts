import type { AiWidget } from "../transport/types";

const NUMBER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 });
const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 20,
});

/**
 * A record value as text: numbers grouped the Indian way (never rounded),
 * money as ₹, the rest as written.
 */
export function formatValue(value: unknown, money = false): string {
  const n = typeof value === "number" ? value : Number(value);
  const numeric =
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "" && /^-?[\d.]+$/.test(value.trim()));
  if (money && numeric && Number.isFinite(n)) return RUPEES.format(n);
  if (typeof value === "number") return NUMBER.format(value);
  if (typeof value === "string") {
    const n = Number(value);
    return value.trim() !== "" && Number.isFinite(n) && /^-?[\d.]+$/.test(value.trim())
      ? NUMBER.format(n)
      : value;
  }
  if (value === null || value === undefined) return "—";
  return String(value);
}

/** A cell value for sorting: numbers as numbers, the rest as text. */
export function sortKey(value: unknown): number | string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && value !== "" && value !== null ? n : String(value ?? "");
}

export type StatusTone = "success" | "warning" | "danger" | "neutral";

const TONES: [RegExp, StatusTone][] = [
  [/^(pending|awaited|due|open|in progress|draft)$/i, "warning"],
  [/^(cleared|done|complete|completed|signed|active|normal|paid|approved)$/i, "success"],
  [/^(h|l|high|low|critical|abnormal|blocked|overdue|failed|rejected)$/i, "danger"],
];

/** The badge tone for a status word; the word itself is always shown too. */
export function statusTone(status: string): StatusTone {
  return TONES.find(([re]) => re.test(status.trim()))?.[1] ?? "neutral";
}

/** Rows of a table kept in a text export; the screen shows them all. */
const EXPORT_ROWS = 50;

/**
 * A widget as plain text for a transcript: its title and key figures in the
 * same formatting the screen uses (₹ for money, Indian grouping).
 */
export function widgetText(w: AiWidget): string {
  const lines: string[] = [`[${w.title}]`];
  switch (w.kind) {
    case "kpis":
      for (const t of w.tiles) lines.push(`- ${t.label}: ${formatValue(t.value, t.money)}`);
      break;
    case "list":
      for (const i of w.items) lines.push(`- ${i.label}${i.status ? `: ${i.status}` : ""}`);
      break;
    case "table":
    case "chart": {
      const cols = w.kind === "table" ? w.columns : [w.x, ...w.series];
      lines.push(cols.map((c) => c.label).join(" | "));
      for (const r of w.rows.slice(0, EXPORT_ROWS)) {
        lines.push(cols.map((c) => formatValue(r[c.key], c.money)).join(" | "));
      }
      if (w.rows.length > EXPORT_ROWS) lines.push(`… ${w.rows.length - EXPORT_ROWS} more rows`);
      if (w.kind === "chart") {
        for (const p of w.peaks ?? []) {
          const s = w.series.find((c) => c.key === p.series);
          lines.push(
            `${s?.label}: highest ${formatValue(p.high, s?.money)} on ${formatValue(p.high_x)}; lowest ${formatValue(p.low, s?.money)} on ${formatValue(p.low_x)}`,
          );
        }
      }
      break;
    }
  }
  return lines.join("\n");
}
