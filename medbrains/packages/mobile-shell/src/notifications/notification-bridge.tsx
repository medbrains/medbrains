/**
 * Shared notification bridge for every Expo persona app (RFC-NOTIFICATION-
 * SYSTEM): registers this device for Expo push and, while foregrounded,
 * presents live notifications received over the WebSocket. Side-effect only —
 * mount once inside the app's AuthProvider. The hooks no-op until sign-in.
 */

import * as Notifications from "expo-notifications";
import { useNotifications } from "./use-notifications.js";
import type { MobileNotificationEvent } from "./notification-url.js";
import { usePushRegistration } from "./use-push-registration.js";

// Show notifications while the app is foregrounded (WS-delivered local presents).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export interface NotificationBridgeProps {
  apiBase: string;
  /** This app's surface code, e.g. `Mobile-Doctor`. */
  surface: string;
  /** EAS project id (bare/EAS builds need it for the Expo push token). */
  projectId?: string;
}

export function NotificationBridge({ apiBase, surface, projectId }: NotificationBridgeProps): null {
  usePushRegistration(apiBase, { surface, projectId });
  useNotifications(apiBase, (event: MobileNotificationEvent) => {
    void Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.body ?? undefined,
        data: { action_url: event.action_url },
      },
      trigger: null, // present immediately
    });
  });
  return null;
}
