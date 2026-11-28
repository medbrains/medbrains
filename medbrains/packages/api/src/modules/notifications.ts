/** The `/notifications` API area. Moved from `client.ts`; one module per first path segment. */
import type { NotificationListResponse, UnreadCountResponse } from "@medbrains/types";
import { request } from "../client.js";

export const notificationsApi = {
  // ── Notification centre ──
  listNotifications: (params?: { unread?: boolean; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.unread) qs.set("unread", "true");
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<NotificationListResponse>(`/notifications${query ? `?${query}` : ""}`);
  },
  notificationsUnreadCount: () => request<UnreadCountResponse>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<UnreadCountResponse>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<UnreadCountResponse>("/notifications/read-all", { method: "POST" }),
  registerPushToken: (input: { expo_token: string; platform?: string; surface?: string }) =>
    request<{ ok: boolean }>("/notifications/push-tokens", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
