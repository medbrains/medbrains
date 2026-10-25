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
