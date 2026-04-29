export const SHIFTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

export function urgencyColor(overdue: number, pending: number): string {
  if (overdue > 0) return "danger";
  if (pending > 0) return "warning";
  return "success";
}

export function news2Color(score: number | null): string {
  if (score === null) return "gray";
  if (score >= 7) return "danger";
  if (score >= 5) return "warning";
  return "success";
}

export function fallRiskColor(level: string | null): string {
  if (!level) return "gray";

  const normalizedLevel = level.toLowerCase();
  if (normalizedLevel.includes("high")) return "danger";
  if (normalizedLevel.includes("medium") || normalizedLevel.includes("moderate")) return "warning";
  return "success";
}

export function readinessColor(percent: number): string {
  if (percent >= 80) return "success";
  if (percent >= 50) return "warning";
  return "danger";
}
