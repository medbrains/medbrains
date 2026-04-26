/**
 * Common date utilities used across the MedBrains frontend.
 * Centralizes formatting, parsing, and comparison logic.
 */

/** Format a Date to YYYY-MM-DD string (for API requests) */
export function toDateString(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().split("T")[0] ?? "";
}

/** Format a Date or ISO string to locale display (e.g., "25 Apr 2026") */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Format a Date or ISO string to locale display with time (e.g., "25 Apr 2026, 14:30") */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Format time only (e.g., "14:30") */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Calculate age from DOB string */
export function calculateAge(dob: string | null | undefined): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    return `${months}mo`;
  }
  if (years < 3) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    return `${Math.floor(months / 12)}y ${months % 12}mo`;
  }
  return `${years}y`;
}

/** Check if a date is today */
export function isToday(date: string | Date): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

/** Check if a date is in the past */
export function isPast(date: string | Date): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return d < new Date();
}

/** Get relative time string (e.g., "2 hours ago", "in 3 days") */
export function relativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
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
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Get next occurrence of a specific month/day (for holidays) */
export function nextOccurrence(month: number, day: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), month, day);
  if (d < now) d.setFullYear(d.getFullYear() + 1);
  return d;
}
