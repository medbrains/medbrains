// Nurse Activities shared helpers — split from nurse-activities.tsx (pure move).

export function compactId(value: string): string {
  return value ? value.slice(0, 8) : "";
}
