const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const COUNT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LAKH = 100_000;
const CRORE = 10_000_000;
const THOUSAND = 1_000;

/** One decimal, without a trailing `.0`. */
const short = (n: number) => String(Math.round(n * 10) / 10);

/** An axis tick for money: ₹2.5L, ₹1.2Cr, ₹850 — readable at a glance. */
export function rupeesAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= CRORE) return `₹${short(value / CRORE)}Cr`;
  if (abs >= LAKH) return `₹${short(value / LAKH)}L`;
  if (abs >= THOUSAND) return `₹${short(value / THOUSAND)}K`;
  return `₹${short(value)}`;
}

/** A tooltip value for money: the full amount, ₹9,98,718.20. */
export const rupees = (value: number): string => RUPEES.format(value);

/** A count, Indian-grouped: 12,34,567. */
export const count = (value: number): string => COUNT.format(value);

/** A date label on the x-axis: `2026-09-26` → "26 Sep", `2026-09` → "Sep 2026". */
export function shortDate(value: unknown): string {
  const v = String(value ?? "");
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (day) return `${Number(day[3])} ${MONTHS[Number(day[2]) - 1] ?? day[2]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(v);
  if (month) return `${MONTHS[Number(month[2]) - 1] ?? month[2]} ${month[1]}`;
  return v;
}
