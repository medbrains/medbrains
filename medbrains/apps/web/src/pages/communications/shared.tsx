// Communications shared helpers — split from communications.tsx (pure move).

export function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requiredText(value: string | null | undefined) {
  return optionalText(value) ?? null;
}
