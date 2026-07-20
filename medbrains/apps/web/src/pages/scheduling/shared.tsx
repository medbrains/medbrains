// Scheduling shared helpers — split from scheduling.tsx (pure move).

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
