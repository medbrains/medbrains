// TV-Displays shared helpers — split from tv-displays.tsx (pure move).

export const QUEUE_REFRESH_MS = 5_000;

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
