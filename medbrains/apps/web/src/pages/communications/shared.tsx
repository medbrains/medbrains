// Communications shared helpers — split from communications.tsx (pure move).

export function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requiredText(value: string | null | undefined) {
  return optionalText(value) ?? null;
}

export function numberValue(value: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
