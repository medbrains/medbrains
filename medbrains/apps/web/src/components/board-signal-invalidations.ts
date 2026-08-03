/**
 * Which cached queries a live board signal invalidates.
 *
 * Board frames arrive on the same socket as inbox notifications (see
 * `useNotificationStream`). Rather than open a second WebSocket per screen that
 * wants live data — one socket per tab is the bound we keep — the single
 * existing subscriber routes board frames through this map.
 *
 * Keys are the server's `ClinicalEventName` strings. An unmapped kind is
 * ignored, so adding an event server-side never breaks the client.
 */
export const BOARD_SIGNAL_QUERY_KEYS: Readonly<Record<string, readonly string[]>> = {
  "opd.vitals.recorded": ["opd-queue"],
};

/** Query key roots to invalidate for a board signal; empty when unmapped. */
export function boardSignalQueryKeys(kind: string): readonly string[] {
  return BOARD_SIGNAL_QUERY_KEYS[kind] ?? [];
}
