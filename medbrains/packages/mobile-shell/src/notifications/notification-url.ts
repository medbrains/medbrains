/** Pure, React-Native-free notification helpers (unit-testable in node). */

/** A live notification pushed over `/ws/notifications` (mirrors the server row). */
export interface MobileNotificationEvent {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
}

/**
 * Derive the notification WebSocket URL from an API base (e.g.
 * `https://host/api`) and a JWT. Strips a trailing `/api`, swaps the scheme to
 * `ws(s)`, and appends the token.
 */
export function notificationWsUrl(apiBase: string, token: string): string {
  const origin = apiBase.replace(/\/api\/?$/, "");
  const wsOrigin = origin.replace(/^http/, "ws");
  return `${wsOrigin}/ws/notifications?token=${encodeURIComponent(token)}`;
}
