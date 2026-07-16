import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuthStore } from "../auth/auth-store.js";

export interface PushRegistrationOptions {
  /** This app's surface code (e.g. `Mobile-Doctor`) — stored with the token. */
  surface?: string;
  /** EAS project id, required by `getExpoPushTokenAsync` in bare/EAS builds. */
  projectId?: string;
}

/**
 * Register this device's Expo push token with the backend so the notification
 * listener can deliver a push when the app is backgrounded (RFC-NOTIFICATION-
 * SYSTEM P4b). Requests permission, fetches the Expo push token, and POSTs it
 * to `POST ${apiBase}/notifications/push-tokens` with the shell's JWT.
 *
 * Best-effort and idempotent: runs when the signed-in user (JWT) changes;
 * failures are swallowed so a denied permission or offline device never crashes
 * the app. The backend upserts by (tenant, user, token).
 */
export function usePushRegistration(apiBase: string, options: PushRegistrationOptions = {}): void {
  const token = useAuthStore((state) => state.identity?.jwt);
  const { surface, projectId } = options;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.status === "granted";
        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync();
          granted = requested.status === "granted";
        }
        if (!granted || cancelled) return;

        const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled || !expoToken) return;

        const base = apiBase.replace(/\/$/, "");
        await fetch(`${base}/notifications/push-tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expo_token: expoToken,
            platform: Platform.OS,
            surface,
          }),
        });
      } catch {
        // Best-effort: a denied permission / offline device must not crash.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, surface, projectId, token]);
}
