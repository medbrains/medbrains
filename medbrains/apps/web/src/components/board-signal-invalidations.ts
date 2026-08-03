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
  "opd.queue.changed": ["opd-queue", "queue-tokens", "queue-state"],
  // A posted result can be a critical value, so the alert list refreshes with
  // the order list — a critical value the screen has not shown yet is the one
  // case where a stale board matters clinically.
  "lab.result.posted": ["lab-orders", "lab-critical-alerts", "queue-tokens"],
  "lab.result.verified": ["lab-orders", "lab-critical-alerts", "queue-tokens"],
  "pharmacy.order.dispensed": ["pharmacy-orders", "queue-tokens"],
};

/** Query key roots to invalidate for a board signal; empty when unmapped. */
export function boardSignalQueryKeys(kind: string): readonly string[] {
  return BOARD_SIGNAL_QUERY_KEYS[kind] ?? [];
}
