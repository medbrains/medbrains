import { Group, Indicator, Popover, ScrollArea, Tabs, Text, UnstyledButton } from "@mantine/core";
import { api } from "@medbrains/api";
import type { AppNotification } from "@medbrains/types";
import { IconBell, IconChecks } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useEffectOnce } from "react-use";
import { Button, IconButton } from "@/components/ui";
import { type NotificationStreamEvent, useNotificationStream } from "@/hooks/useNotificationStream";
import styles from "./NotificationCenter.module.scss";

const KIND_TONE: Record<string, string> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** In-app notification centre — bell + unread badge + a feed dropdown. */
export function NotificationCenter() {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: count } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api.notificationsUnreadCount(),
    // Live delivery is the WS stream below; the poll is only a fallback.
    refetchInterval: 60_000,
  });
  const { data: list, isLoading } = useQuery({
    queryKey: ["notifications", tab],
    queryFn: () => api.listNotifications({ unread: tab === "unread", limit: 30 }),
    enabled: opened,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  // Ask once for OS-level notification permission so live events can pop a
  // browser notification even when the tab is unfocused.
  useEffectOnce(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  });

  const showBrowserNotification = (event: NotificationStreamEvent) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notification = new Notification(event.title, {
      body: event.body ?? undefined,
      tag: event.id, // de-dupes if the same event re-delivers
    });
    notification.onclick = () => {
      window.focus();
      if (event.action_url) navigate(event.action_url);
      notification.close();
    };
  };

  // Live stream: refresh the feed/badge and raise a browser notification.
  useNotificationStream((event) => {
    invalidate();
    showBrowserNotification(event);
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  const unread = count?.unread_count ?? 0;
  const items = list?.notifications ?? [];

  const handleItem = (notification: AppNotification) => {
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.action_url) {
      setOpened(false);
      navigate(notification.action_url);
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={380}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Indicator
          disabled={unread === 0}
          label={unread > 9 ? "9+" : unread}
          size={16}
          color="danger"
          offset={4}
        >
          <IconButton
            aria-label="Notifications"
            tone="default"
            onClick={() => setOpened((o) => !o)}
          >
            <IconBell size={18} />
          </IconButton>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="md" py="sm" className={styles.header}>
          <Text fw={600} size="sm">
            Notifications
          </Text>
          {unread > 0 && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconChecks size={14} />}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </Button>
          )}
        </Group>
        <Tabs
          value={tab}
          onChange={(value) => setTab(value === "unread" ? "unread" : "all")}
          px="md"
        >
          <Tabs.List>
            <Tabs.Tab value="all">All</Tabs.Tab>
            <Tabs.Tab value="unread">{unread > 0 ? `Unread (${unread})` : "Unread"}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <ScrollArea.Autosize mah={420}>
          {isLoading ? (
            <Text c="dimmed" size="sm" p="md">
              Loading…
            </Text>
          ) : items.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              You're all caught up.
            </Text>
          ) : (
            items.map((notification) => (
              <UnstyledButton
                key={notification.id}
                className={styles.item}
                data-unread={!notification.is_read || undefined}
                onClick={() => handleItem(notification)}
              >
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <span className={styles.dot} data-tone={KIND_TONE[notification.kind] ?? "info"} />
                  <div className={styles.body}>
                    <Text size="sm" fw={notification.is_read ? 400 : 600} lineClamp={1}>
                      {notification.title}
                    </Text>
                    {notification.body && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {notification.body}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" mt={2}>
                      {notification.category ? `${notification.category} · ` : ""}
                      {timeAgo(notification.created_at)}
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
            ))
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
