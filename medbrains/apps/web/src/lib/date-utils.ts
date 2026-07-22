/**
 * Common date utilities used across the MedBrains frontend.
 * Centralizes formatting, parsing, and comparison logic.
 */

/** Format a Date to YYYY-MM-DD string (for API requests) */
export function toDateString(date: Date | null | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}

function parseDateOnly(dateStr: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateValue(date: string | Date): Date {
  if (date instanceof Date) return date;
  return parseDateOnly(date) ?? new Date(date);
}

/** Format a Date or ISO string to locale display (e.g., "25 Apr 2026") */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Format a Date or ISO string to locale display with time (e.g., "25 Apr 2026, 14:30") */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format time only (e.g., "14:30") */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Whole months elapsed between two dates, not counting a month until its
 * day-of-month has come round.
 */
function completedMonths(birth: Date, now: Date): number {
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  return now.getDate() < birth.getDate() ? months - 1 : months;
}

/**
 * Calculate age from DOB string.
 *
 * Age is completed years, so the birthday has to have come round: on
 * 2026-07-22 a child born 2020-12-25 is 5, not 6. Subtracting the calendar
 * years alone overstates the age of anyone whose birthday falls later in the
 * year, which for paediatric dosing bands is the difference between two
 * different doses.
 */
export function calculateAge(dob: string | null | undefined): string {
  if (!dob) return "—";
  const birth = parseDateOnly(dob) ?? new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  const months = completedMonths(birth, now);
  const years = Math.floor(months / 12);
  if (years < 1) return `${Math.max(months, 0)}mo`;
  if (years < 3) return `${years}y ${months % 12}mo`;
  return `${years}y`;
}

/** Check if a date is today */
export function isToday(date: string | Date): boolean {
  const d = parseDateValue(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/** Check if a date is in the past */
export function isPast(date: string | Date): boolean {
  const d = parseDateValue(date);
  return d < new Date();
}

/** Get relative time string (e.g., "2 hours ago", "in 3 days") */
export function relativeTime(date: string | Date): string {
  const d = parseDateValue(date);
  const diff = Date.now() - d.getTime();
  const absDiff = Math.abs(diff);
  const past = diff > 0;

  if (absDiff < 60_000) return "just now";
  if (absDiff < 3600_000) {
    const mins = Math.floor(absDiff / 60_000);
    return past ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiff < 86400_000) {
    const hours = Math.floor(absDiff / 3600_000);
    return past ? `${hours}h ago` : `in ${hours}h`;
  }
  const days = Math.floor(absDiff / 86400_000);
  return past ? `${days}d ago` : `in ${days}d`;
}

/** Parse YYYY-MM-DD string to Date */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = parseDateOnly(dateStr) ?? new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Get next occurrence of a specific month/day (for holidays) */
export function nextOccurrence(month: number, day: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), month, day);
  if (d < now) d.setFullYear(d.getFullYear() + 1);
  return d;
}
