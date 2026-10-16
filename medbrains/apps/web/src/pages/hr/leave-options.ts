// Leave vocabulary shared by HR's leave tab and the self-service "My leave" card.

export const LEAVE_TYPE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "earned", label: "Earned" },
  { value: "medical", label: "Medical" },
  { value: "maternity", label: "Maternity" },
  { value: "paternity", label: "Paternity" },
  { value: "compensatory", label: "Compensatory" },
  { value: "study", label: "Study" },
  { value: "special", label: "Special" },
  { value: "loss_of_pay", label: "Loss of Pay" },
];

const DAY_MS = 86_400_000;

/** Calendar days from start to end inclusive; 0.5 for a half day; null if the range is invalid. */
export function leaveDays(start: string, end: string, isHalfDay: boolean): number | null {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  if (isHalfDay) return from === to ? 0.5 : null;
  return (to - from) / DAY_MS + 1;
}
