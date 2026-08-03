import {
  Box,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconBell, IconDeviceTv, IconExternalLink, IconTicket } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PageHeader } from "@/components";
import { Badge, Button, IconButton } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { tvDisplaysService } from "@/services/tvDisplays.service";
import { AnnouncementsTab } from "./tv-displays/announcements-tab";
import { DisplaysTab } from "./tv-displays/displays-tab";
import { QueueTokensTab } from "./tv-displays/queue-tokens-tab";
import {
  DISPLAY_LIST_REFRESH_MS,
  type DisplayLaunchTarget,
  displayLaunchTarget,
  QUEUE_REFRESH_MS,
  todayIsoDate,
} from "./tv-displays/shared";
import styles from "./tv-displays.module.scss";

// ── Constants ──────────────────────────────────────────

const TV_DISPLAY_TAB_VALUES = ["displays", "tokens", "announcements"] as const;

type TvDisplayTabValue = (typeof TV_DISPLAY_TAB_VALUES)[number];

function isTvDisplayTabValue(value: string): value is TvDisplayTabValue {
  return TV_DISPLAY_TAB_VALUES.some((tabValue) => tabValue === value);
}

export function TvDisplaysPage() {
  useRequirePermission(P.ADMIN.TV_DISPLAYS.LIST);

  const [activeTab, setActiveTab] = useHashTabs("displays", TV_DISPLAY_TAB_VALUES);
  const canCreate = useHasPermission(P.ADMIN.TV_DISPLAYS.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.TV_DISPLAYS.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.TV_DISPLAYS.DELETE);
  const canManageTokens = useHasPermission(P.ADMIN.TV_DISPLAYS.TOKENS);
  const canBroadcast = useHasPermission(P.ADMIN.TV_DISPLAYS.BROADCAST);
  const today = todayIsoDate();

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
    refetchInterval: DISPLAY_LIST_REFRESH_MS,
  });
  const { data: tokens = [] } = useQuery({
    queryKey: ["queue-tokens", today, "workspace-summary"],
    queryFn: () => tvDisplaysService.listQueueTokens({ date: today }),
    enabled: canManageTokens,
    refetchInterval: QUEUE_REFRESH_MS,
  });

  const registeredDisplayCount = displays.length;
  const queueDisplayCount = displays.filter((display) =>
    display.display_type.includes("queue"),
  ).length;
  const currentTokens = tokens.filter(
    (token) => token.status === "called" || token.status === "in_progress",
  );
  const waitingTokenCount = tokens.filter((token) => token.status === "waiting").length;
  const displayLaunchRows = useMemo(() => {
    const launchRows = new Map<
      string,
      DisplayLaunchTarget & {
        count: number;
      }
    >();

    for (const display of displays) {
      const target = displayLaunchTarget(display.display_type, display.department_id);
      if (!target) continue;
      const existing = launchRows.get(target.href);
      if (existing) {
        existing.count += 1;
      } else {
        launchRows.set(target.href, { ...target, count: 1 });
      }
    }

    return [...launchRows.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [displays]);
  const activeTabLabel: Record<TvDisplayTabValue, string> = {
    announcements: "Announcements",
    displays: "Displays",
    tokens: "Queue Tokens",
  };
  const activeWorkspaceLabel = isTvDisplayTabValue(activeTab)
    ? activeTabLabel[activeTab]
    : activeTabLabel.displays;

  return (
    <Stack className={styles.displayWorkspace}>
      <PageHeader
        title="TV Displays & Queue"
        subtitle="Manage TV displays, queue tokens, and announcements"
      />

      <Card withBorder className={styles.displayCommandBar}>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Queue display command center
            </Text>
            <Group gap="xs">
              <Badge tone="success">{registeredDisplayCount} registered displays</Badge>
              <Badge tone="info">{queueDisplayCount} queue boards</Badge>
              {canManageTokens && (
                <>
                  <Badge tone="warning">{waitingTokenCount} waiting</Badge>
                  <Badge tone="success">{currentTokens.length} called/in progress</Badge>
                </>
              )}
            </Group>
          </Stack>
          <Group gap="xs" className={styles.displayCommandActions}>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconDeviceTv size={14} />}
              onClick={() => setActiveTab("displays")}
            >
              Displays
            </Button>
            {canManageTokens && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconTicket size={14} />}
                onClick={() => setActiveTab("tokens")}
              >
                Tokens
              </Button>
            )}
            {canBroadcast && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconBell size={14} />}
                onClick={() => setActiveTab("announcements")}
              >
                Broadcast
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
        <Grid align="flex-start" className={styles.displayGrid}>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack className={styles.displayMain}>
              <Tabs.List className={styles.displayTabsList}>
                <Tabs.Tab value="displays" leftSection={<IconDeviceTv size={16} />}>
                  Displays
                </Tabs.Tab>
                <Tabs.Tab value="tokens" leftSection={<IconTicket size={16} />}>
                  Queue Tokens
                </Tabs.Tab>
                <Tabs.Tab value="announcements" leftSection={<IconBell size={16} />}>
                  Announcements
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel id="tv-displays" value="displays" pt="md">
                <DisplaysTab canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
              </Tabs.Panel>
              <Tabs.Panel id="tv-tokens" value="tokens" pt="md">
                <QueueTokensTab canManage={canManageTokens} />
              </Tabs.Panel>
              <Tabs.Panel id="tv-announcements" value="announcements" pt="md">
                <AnnouncementsTab canBroadcast={canBroadcast} />
              </Tabs.Panel>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card withBorder className={styles.displayRail}>
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    TV / kiosk workspace
                  </Text>
                  <Text size="sm" fw={700}>
                    {activeWorkspaceLabel}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Web operators, Android TV boards, and desktop kiosks share this queue state.
                  </Text>
                </Stack>
                <Divider />
                <SimpleGrid cols={2} spacing="xs">
                  <Box className={styles.railMetric}>
                    <Text size="xs" c="dimmed">
                      Registered
                    </Text>
                    <Text fw={700}>{registeredDisplayCount}</Text>
                  </Box>
                  <Box className={styles.railMetric}>
                    <Text size="xs" c="dimmed">
                      Queue boards
                    </Text>
                    <Text fw={700}>{queueDisplayCount}</Text>
                  </Box>
                  <Box className={styles.railMetric}>
                    <Text size="xs" c="dimmed">
                      Waiting
                    </Text>
                    <Text fw={700}>{canManageTokens ? waitingTokenCount : "—"}</Text>
                  </Box>
                  <Box className={styles.railMetric}>
                    <Text size="xs" c="dimmed">
                      Now
                    </Text>
                    <Text fw={700}>
                      {canManageTokens
                        ? currentTokens.map((token) => token.token_number).join(", ") || "—"
                        : "—"}
                    </Text>
                  </Box>
                </SimpleGrid>
                <Divider />
                {displayLaunchRows.length > 0 && (
                  <>
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                          Launch targets
                        </Text>
                        <Badge tone="neutral" size="xs">
                          {displayLaunchRows.length}
                        </Badge>
                      </Group>
                      {displayLaunchRows.map((target) => (
                        <Group
                          key={target.href}
                          justify="space-between"
                          gap="xs"
                          className={styles.launchRow}
                        >
                          <Stack gap={0}>
                            <Text size="xs" fw={700}>
                              {target.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {target.href}
                            </Text>
                          </Stack>
                          <Group gap={4} justify="flex-end">
                            {target.appCodes.map((appCode) => (
                              <Badge key={appCode} tone="neutral" size="xs" variant="outline">
                                {appCode}
                              </Badge>
                            ))}
                            <Badge tone="neutral" size="xs">
                              {target.count}
                            </Badge>
                            <Tooltip label={`Open ${target.label}`}>
                              <IconButton
                                onClick={() => {
                                  window.location.href = target.href;
                                }}
                                tone="default"
                                aria-label={`Open ${target.label}`}
                              >
                                <IconExternalLink size={14} />
                              </IconButton>
                            </Tooltip>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                    <Divider />
                  </>
                )}
                <Stack gap="xs">
                  <Button
                    tone={activeTab === "displays" ? "primary" : "secondary"}
                    size="xs"
                    leftSection={<IconDeviceTv size={14} />}
                    onClick={() => setActiveTab("displays")}
                    fullWidth
                  >
                    Display registry
                  </Button>
                  {canManageTokens && (
                    <Button
                      tone={activeTab === "tokens" ? "primary" : "secondary"}
                      size="xs"
                      leftSection={<IconTicket size={14} />}
                      onClick={() => setActiveTab("tokens")}
                      fullWidth
                    >
                      Token operations
                    </Button>
                  )}
                  {canBroadcast && (
                    <Button
                      tone={activeTab === "announcements" ? "primary" : "secondary"}
                      size="xs"
                      leftSection={<IconBell size={14} />}
                      onClick={() => setActiveTab("announcements")}
                      fullWidth
                    >
                      Broadcast alerts
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Tabs>
    </Stack>
  );
}

export default TvDisplaysPage;
