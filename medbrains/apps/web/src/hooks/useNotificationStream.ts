import { useEffect, useRef } from "react";

/** A live notification pushed over `/ws/notifications` (mirrors the server row). */
export interface NotificationStreamEvent {
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
 * Subscribe to the server's live notification stream (`/ws/notifications`,
 * RFC-NOTIFICATION-SYSTEM). Calls `onEvent(event)` whenever a notification
 * arrives so the caller can refresh its badge/feed and raise a browser
 * notification; the REST poll stays as a fallback.
 *
 * Constrained-device discipline (bounded network + zero leaks):
 * - **Bounded reconnect** with exponential backoff (capped at 30s) + jitter —
 *   never a tight reconnect loop.
 * - **Pauses when the tab is hidden** (no socket churn in the background);
 *   reconnects on return to foreground.
 * - **Full teardown** on unmount: socket closed, timer cleared, listener removed.
 *
 * Auth is implicit: the browser sends the `access_token` cookie on the WS
 * upgrade, so no token is placed in the URL.
 */
export function useNotificationStream(onEvent: (event: NotificationStreamEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/notifications`;

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      const backoff = Math.min(30_000, 2 ** Math.min(attempts, 5) * 1000);
      const jitter = Math.random() * 1000;
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoff + jitter);
    };

    const connect = () => {
      if (closed || document.hidden || ws) return;
      const socket = new WebSocket(url);
      ws = socket;
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data as string) as NotificationStreamEvent;
          if (event && typeof event.id === "string") onEventRef.current(event);
        } catch {
          // Ignore malformed frames — the REST poll remains the source of truth.
        }
      };
      socket.onclose = () => {
        if (ws === socket) ws = null;
        scheduleReconnect();
      };
      socket.onerror = () => {
        socket.close();
      };
    };

    const onVisibility = () => {
      if (!document.hidden && !ws) connect();
    };

    document.addEventListener("visibilitychange", onVisibility);
    connect();

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
    };
  }, []);
}
