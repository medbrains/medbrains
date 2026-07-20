// Appointments shared helpers — split from appointments.tsx (pure move).

import { toDateString } from "@/lib/date-utils";

export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function toFormDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : toDateString(value);
}
