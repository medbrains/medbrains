import type { BadgeTone } from "@/components/ui";

const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** A decimal string from the server as rupees; a missing value stays visible. */
export function rupees(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? RUPEES.format(n) : value;
}

export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
}

/** "2026-27" for today, as the TDS register is kept. */
export function currentFinancialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const STATEMENT_TONE: Record<string, BadgeTone> = {
  draft: "info",
  disputed: "warning",
  approved: "success",
  paid: "neutral",
  superseded: "neutral",
  cancelled: "neutral",
};

export const EVENT_LABEL: Record<string, string> = {
  billed: "Billed",
  collected: "Collected",
  realised: "Insurer settled",
  reversal: "Reversal",
  session_minimum: "Session minimum",
  adjustment: "Adjustment",
  referral: "Referral",
};

export const ENGAGEMENTS = [
  { value: "fee_for_service", label: "Fee for service" },
  { value: "visiting", label: "Visiting consultant" },
  { value: "day", label: "Day / sessional" },
  { value: "retainer", label: "Retainer" },
  { value: "on_call", label: "On call" },
  { value: "salaried", label: "Salaried (paid through payroll)" },
];

export const BASES = [
  { value: "billed", label: "When billed" },
  { value: "collected", label: "When the patient pays" },
  { value: "realised", label: "When the insurer settles" },
];

export const BEARERS = [
  { value: "hospital", label: "Hospital absorbs it" },
  { value: "doctor", label: "Doctor absorbs it" },
  { value: "pro_rata", label: "Shared pro rata" },
];

/** The server's error, said plainly; never an empty screen. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/** Save the bank upload file the server built. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
