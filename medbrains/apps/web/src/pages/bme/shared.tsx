// BME shared helpers — split from bme.tsx (pure move).

import { Badge, type BadgeTone } from "@/components/ui";

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

export const PM_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

export const BREAKDOWN_PRIORITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function priorityBadge(p: string) {
  const map: Record<string, BadgeTone> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "primary",
  };
  return (
    <Badge tone={map[p] ?? "neutral"} variant="light" size="sm">
      {p}
    </Badge>
  );
}
