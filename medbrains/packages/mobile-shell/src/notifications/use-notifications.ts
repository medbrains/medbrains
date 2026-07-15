/**
 * Live notification stream for mobile shells (RFC-NOTIFICATION-SYSTEM, P3).
 *
 * Subscribes to the server's `/ws/notifications` WebSocket (Bearer auth via
 * `?token=` since React Native can't set WS headers) and invokes `onEvent` for
 * each notification, so the app can update its badge/centre and raise a local
 * notification. The REST feed remains the source of truth for catch-up.
 *
 * Constrained-device discipline (bounded network + zero leaks):
 * - **Bounded reconnect** with exponential backoff (cap 30s) + jitter.
 * - **Pauses when the app is backgrounded** (RN `AppState`); reconnects on
 *   return to foreground. No socket churn while backgrounded.
 * - **Full teardown** on unmount / token change: socket closed, timer cleared,
 *   `AppState` subscription removed.
 */

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "../auth/auth-store.js";
import { type MobileNotificationEvent, notificationWsUrl } from "./notification-url.js";

export function useNotifications(
  apiBase: string,
  onEvent: (event: MobileNotificationEvent) => void,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const token = useAuthStore((state) => state.identity?.jwt);

  useEffect(() => {
    if (!token) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const url = notificationWsUrl(apiBase, token);

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
      if (closed || ws || AppState.currentState !== "active") return;
      const socket = new WebSocket(url);
      ws = socket;
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data as string) as MobileNotificationEvent;
          if (event && typeof event.id === "string") onEventRef.current(event);
        } catch {
          // Ignore malformed frames — the REST feed remains the source of truth.
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

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connect();
      } else {
        // Backgrounded: drop the socket to save battery/radio.
        ws?.close();
        ws = null;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }
    });

    connect();

    return () => {
      closed = true;
      appStateSub.remove();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
    };
  }, [apiBase, token]);
}
