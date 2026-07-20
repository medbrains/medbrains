import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type TvDisplayFormInput, tvDisplayFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateTvDisplayRequest,
  DepartmentRow,
  TokenBoardSurfaceDefinition,
  TvDisplay,
  UpdateTvDisplayRequest,
} from "@medbrains/types";
import { P, TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";
import {
  IconBell,
  IconDeviceTv,
  IconExternalLink,
  IconPencil,
  IconPlus,
  IconTicket,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import {
  defaultTvDisplayFormValues,
  tvDisplayAllowsPatientNames,
  tvDisplayFormToCreateRequest,
  tvDisplayFormToUpdateRequest,
  tvDisplayToForm,
} from "@/forms/tv-displays.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { tvDisplaysService } from "@/services/tvDisplays.service";
import { AnnouncementsTab } from "./tv-displays/announcements-tab";
import { QueueTokensTab } from "./tv-displays/queue-tokens-tab";
import { QUEUE_REFRESH_MS, todayIsoDate } from "./tv-displays/shared";
import styles from "./tv-displays.module.scss";

// ── Constants ──────────────────────────────────────────

const DISPLAY_TYPES = [
  ...TOKEN_BOARD_SURFACE_LIST.map((surface) => ({
    value: surface.targets.tvDisplayType,
    label: surface.title,
  })),
  { value: "bed_status", label: "Bed Status Board" },
  { value: "digital_signage", label: "Digital Signage" },
  { value: "dashboard", label: "Dashboard" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "bn", label: "Bengali" },
];

const TV_DISPLAY_TAB_VALUES = ["displays", "tokens", "announcements"] as const;

type TvDisplayTabValue = (typeof TV_DISPLAY_TAB_VALUES)[number];

function isTvDisplayTabValue(value: string): value is TvDisplayTabValue {
  return TV_DISPLAY_TAB_VALUES.some((tabValue) => tabValue === value);
}

const displayTypeLabels: Record<string, string> = {
  ...Object.fromEntries(
    TOKEN_BOARD_SURFACE_LIST.map((surface) => [surface.targets.tvDisplayType, surface.title]),
  ),
  bed_status: "Bed Status",
  digital_signage: "Signage",
  dashboard: "Dashboard",
};

interface DisplayLaunchDefinition {
  appCodes: readonly string[];
  deepLink: string;
  label: string;
  supportsDepartment?: boolean;
}

interface DisplayLaunchTarget {
  appCodes: readonly string[];
  href: string;
  label: string;
}

function tokenBoardLaunchDefinition(surface: TokenBoardSurfaceDefinition): DisplayLaunchDefinition {
  return {
    appCodes: surface.targets.tvAppCodes,
    deepLink: surface.targets.tvDeepLink,
    label: `${surface.title} board`,
    supportsDepartment: surface.id === "opd",
  };
}

const DISPLAY_LAUNCH_TARGETS: Record<string, DisplayLaunchDefinition> = {
  ...Object.fromEntries(
    TOKEN_BOARD_SURFACE_LIST.map((surface) => [
      surface.targets.tvDisplayType,
      tokenBoardLaunchDefinition(surface),
    ]),
  ),
  bed_status: {
    appCodes: ["TV-Ward"],
    deepLink: "medbrains://tv/bed-status",
    label: "Bed status board",
  },
  digital_signage: {
    appCodes: ["TV-Notice"],
    deepLink: "medbrains://tv/digital-signage",
    label: "Digital signage",
  },
};

function displayLaunchTarget(
  displayType: string,
  departmentId?: string | null,
): DisplayLaunchTarget | null {
  const target = DISPLAY_LAUNCH_TARGETS[displayType];
  if (!target) return null;

  const departmentQuery =
    target.supportsDepartment && departmentId
      ? `?department=${encodeURIComponent(departmentId)}`
      : "";

  return {
    appCodes: target.appCodes,
    href: `${target.deepLink}${departmentQuery}`,
    label: target.label,
  };
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

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
    refetchInterval: QUEUE_REFRESH_MS,
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

// ══════════════════════════════════════════════════════════
//  Displays Tab
// ══════════════════════════════════════════════════════════

function DisplaysTab({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDisplay, setSelectedDisplay] = useState<TvDisplay | null>(null);
  const displayForm = useForm<TvDisplayFormInput>({
    resolver: zodResolver(tvDisplayFormSchema),
    defaultValues: defaultTvDisplayFormValues,
  });
  const selectedDisplayType = displayForm.watch("display_type");
  const canShowPatientNames = tvDisplayAllowsPatientNames(selectedDisplayType);

  const { data: displays = [], isLoading } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => tvDisplaysService.listDepartments(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTvDisplayRequest) => tvDisplaysService.createTvDisplay(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display created", { title: "Success" });
      close();
    },
    onError: () => {
      toast.error("Failed to create display", { title: "Error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTvDisplayRequest }) =>
      tvDisplaysService.updateTvDisplay(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display updated", { title: "Success" });
      close();
    },
    onError: () => {
      toast.error("Failed to update display", { title: "Error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.deleteTvDisplay(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      toast.success("Display deleted", { title: "Success" });
    },
    onError: () => {
      toast.error("Failed to delete display", { title: "Error" });
    },
  });

  const columns: Column<TvDisplay>[] = [
    { key: "location_name", label: "Location", render: (row) => row.location_name },
    {
      key: "display_type",
      label: "Type",
      render: (row) => (
        <Badge tone="primary">{displayTypeLabels[row.display_type] || row.display_type}</Badge>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (row) => {
        const dept = departments.find((d: DepartmentRow) => d.id === row.department_id);
        return dept?.name || "All";
      },
    },
    {
      key: "launch_target",
      label: "Launch Target",
      render: (row) => {
        const target = displayLaunchTarget(row.display_type, row.department_id);
        if (!target) return <Text c="dimmed">Not linked</Text>;
        return (
          <Stack gap={2}>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                {target.label}
              </Text>
              {target.appCodes.map((appCode) => (
                <Badge key={appCode} tone="neutral" size="xs">
                  {appCode}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed">
              {target.href}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "language",
      label: "Languages",
      render: (row) => (
        <Group gap="xs">
          {row.language.map((lang) => (
            <Badge key={lang} tone="neutral" size="xs" variant="outline">
              {lang.toUpperCase()}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: "show_patient_name",
      label: "Options",
      render: (row) => {
        const patientNamesAllowed = tvDisplayAllowsPatientNames(row.display_type);
        return (
          <Group gap="xs">
            {patientNamesAllowed && row.show_patient_name && (
              <Badge tone="warning" size="xs">
                Names enabled
              </Badge>
            )}
            {(!patientNamesAllowed || !row.show_patient_name) && (
              <Badge tone="success" size="xs">
                Token-only
              </Badge>
            )}
            {!patientNamesAllowed && row.show_patient_name && (
              <Badge tone="danger" size="xs">
                Names blocked
              </Badge>
            )}
            {row.show_wait_time && (
              <Badge tone="primary" size="xs">
                Wait
              </Badge>
            )}
            {row.announcement_enabled && (
              <Badge tone="warning" size="xs">
                Announcements
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (row) => {
        const target = displayLaunchTarget(row.display_type, row.department_id);
        return (
          <Group gap="xs">
            {target && (
              <Tooltip label={`Open ${target.label}`}>
                <IconButton
                  onClick={() => {
                    window.location.href = target.href;
                  }}
                  tone="default"
                  aria-label={`Open ${target.label}`}
                >
                  <IconExternalLink size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canUpdate && (
              <Tooltip label="Edit">
                <IconButton
                  tone="default"
                  onClick={() => {
                    setSelectedDisplay(row);
                    displayForm.reset(tvDisplayToForm(row));
                    open();
                  }}
                  aria-label="Edit"
                >
                  <IconPencil size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip label="Delete">
                <IconButton
                  tone="danger"
                  onClick={() =>
                    confirmDestructive({
                      title: "Delete",
                      message: "Permanently delete this record? This cannot be undone.",
                      onConfirm: () => deleteMutation.mutate(row.id),
                    })
                  }
                  aria-label="Delete"
                >
                  <IconTrash size={16} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  const handleSubmit = displayForm.handleSubmit((values) => {
    if (selectedDisplay) {
      updateMutation.mutate({
        id: selectedDisplay.id,
        data: tvDisplayFormToUpdateRequest(values),
      });
    } else {
      createMutation.mutate(tvDisplayFormToCreateRequest(values));
    }
  });

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setSelectedDisplay(null);
              displayForm.reset(defaultTvDisplayFormValues);
              open();
            }}
          >
            Add Display
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={displays} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title={selectedDisplay ? "Edit Display" : "Add Display"}
        position="right"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Location Name"
              placeholder="e.g., OPD Waiting Hall"
              error={displayForm.formState.errors.location_name?.message}
              {...displayForm.register("location_name")}
              required
            />
            <Controller
              control={displayForm.control}
              name="display_type"
              render={({ field, fieldState }) => (
                <Select
                  label="Display Type"
                  data={DISPLAY_TYPES}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "opd_queue")}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="department_id"
              render={({ field, fieldState }) => (
                <Select
                  label="Department"
                  placeholder="All departments"
                  data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="doctors_per_screen"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Doctors Per Screen"
                  min={1}
                  max={8}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="language"
              render={({ field, fieldState }) => (
                <MultiSelect
                  label="Languages"
                  data={LANGUAGES}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="scroll_speed"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Scroll Speed (seconds)"
                  min={1}
                  max={30}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="show_patient_name"
              render={({ field }) => (
                <Switch
                  label="Show patient name on authorized staff displays"
                  description={
                    canShowPatientNames
                      ? "Enable only for controlled team-room displays."
                      : "Public token boards are enforced as token-only displays."
                  }
                  checked={canShowPatientNames && field.value}
                  disabled={!canShowPatientNames}
                  onChange={(event) =>
                    field.onChange(canShowPatientNames && event.currentTarget.checked)
                  }
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="show_wait_time"
              render={({ field }) => (
                <Switch
                  label="Show Wait Time"
                  description="Allowed on public token boards when it does not reveal patient identity or clinical context."
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={displayForm.control}
              name="announcement_enabled"
              render={({ field }) => (
                <Switch
                  label="Enable Announcements"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Group justify="flex-end" mt="md">
              <Button tone="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                tone="primary"
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {selectedDisplay ? "Update" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}

export default TvDisplaysPage;
