/**
 * Wires the shell's notification hooks into the staff app (RFC-NOTIFICATION-
 * SYSTEM): registers this device for Expo push and, while foregrounded,
 * presents live notifications received over the WebSocket. Side-effect only.
 */

import {
  type MobileNotificationEvent,
  useNotifications,
  usePushRegistration,
} from "@medbrains/mobile-shell";
import * as Notifications from "expo-notifications";

// Show notifications while the app is foregrounded (WS-delivered local presents).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export function NotificationBridge({ apiBase }: { apiBase: string }): null {
  usePushRegistration(apiBase, { surface: "Mobile-Staff" });
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
