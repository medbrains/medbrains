// BME shared helpers — split from bme.tsx (pure move).

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}
