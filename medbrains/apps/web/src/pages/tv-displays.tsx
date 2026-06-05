import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
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
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type QueueTokenFormInput,
  queueTokenFormSchema,
  type TvAnnouncementFormInput,
  type TvDisplayFormInput,
  tvAnnouncementFormSchema,
  tvDisplayFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  BroadcastAnnouncementRequest,
  CreateQueueTokenRequest,
  CreateTvDisplayRequest,
  DepartmentRow,
  QueueToken,
  QueueTokenStatus,
  TvDisplay,
  UpdateTvDisplayRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBell,
  IconCheck,
  IconDeviceTv,
  IconExternalLink,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTicket,
  IconTrash,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import {
  defaultQueueTokenFormValues,
  defaultTvAnnouncementFormValues,
  defaultTvDisplayFormValues,
  queueTokenFormToRequest,
  tvAnnouncementFormToRequest,
  tvDisplayFormToCreateRequest,
  tvDisplayFormToUpdateRequest,
  tvDisplayToForm,
} from "@/forms/tv-displays.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { tvDisplaysService } from "@/services/tvDisplays.service";
import styles from "./tv-displays.module.scss";

// ── Constants ──────────────────────────────────────────

const DISPLAY_TYPES = [
  { value: "opd_queue", label: "OPD Queue Display" },
  { value: "pharmacy_queue", label: "Pharmacy Queue" },
  { value: "billing_queue", label: "Billing Queue" },
  { value: "lab_queue", label: "Lab Queue" },
  { value: "radiology_queue", label: "Radiology Queue" },
  { value: "bed_status", label: "Bed Status Board" },
  { value: "emergency_triage", label: "Emergency Triage" },
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

const TOKEN_STATUSES = [
  { value: "waiting", label: "Waiting" },
  { value: "called", label: "Called" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
];

const TV_DISPLAY_TAB_VALUES = ["displays", "tokens", "announcements"] as const;

type TvDisplayTabValue = (typeof TV_DISPLAY_TAB_VALUES)[number];

function isTvDisplayTabValue(value: string): value is TvDisplayTabValue {
  return TV_DISPLAY_TAB_VALUES.some((tabValue) => tabValue === value);
}

const ANNOUNCEMENT_PRIORITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "emergency", label: "Emergency" },
];

const statusColors: Record<string, string> = {
  waiting: "slate",
  called: "primary",
  in_progress: "success",
  completed: "success",
  no_show: "danger",
  cancelled: "slate",
};

const displayTypeLabels: Record<string, string> = {
  opd_queue: "OPD Queue",
  pharmacy_queue: "Pharmacy",
  billing_queue: "Billing",
  lab_queue: "Lab",
  radiology_queue: "Radiology",
  bed_status: "Bed Status",
  emergency_triage: "ER Triage",
  digital_signage: "Signage",
  dashboard: "Dashboard",
};

const QUEUE_REFRESH_MS = 5_000;

interface DisplayLaunchDefinition {
  appCode: string;
  label: string;
  path: string;
  supportsDepartment?: boolean;
}

interface DisplayLaunchTarget {
  appCode: string;
  href: string;
  label: string;
}

const DISPLAY_LAUNCH_TARGETS: Record<string, DisplayLaunchDefinition> = {
  bed_status: { appCode: "TV-Ward", label: "Bed status board", path: "bed-status" },
  billing_queue: { appCode: "TV-Billing", label: "Billing queue board", path: "billing-queue" },
  digital_signage: {
    appCode: "TV-Notice",
    label: "Digital signage",
    path: "digital-signage",
  },
  emergency_triage: {
    appCode: "TV-Emergency",
    label: "Emergency triage board",
    path: "emergency-triage",
  },
  lab_queue: { appCode: "TV-Lab", label: "Lab status board", path: "lab-status" },
  opd_queue: {
    appCode: "TV-Queue",
    label: "OPD queue board",
    path: "queue",
    supportsDepartment: true,
  },
  pharmacy_queue: {
    appCode: "TV-Pharmacy",
    label: "Pharmacy queue board",
    path: "pharmacy-queue",
  },
};

interface DepartmentQueueLane {
  departmentId: string;
  departmentName: string;
  currentTokens: QueueToken[];
  displayCount: number;
  nextToken: QueueToken | null;
  nextTokens: QueueToken[];
  waitingCount: number;
}

function toQueueTokenStatus(value: string | null): QueueTokenStatus | null {
  if (
    value === "waiting" ||
    value === "called" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "no_show" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function tokenStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function departmentName(departments: DepartmentRow[], departmentId: string) {
  return departments.find((department) => department.id === departmentId)?.name ?? departmentId;
}

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
    appCode: target.appCode,
    href: `medbrains://tv/${target.path}${departmentQuery}`,
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
              <Badge color="teal" variant="light">
                {registeredDisplayCount} registered displays
              </Badge>
              <Badge color="blue" variant="light">
                {queueDisplayCount} queue boards
              </Badge>
              {canManageTokens && (
                <>
                  <Badge color="orange" variant="light">
                    {waitingTokenCount} waiting
                  </Badge>
                  <Badge color="green" variant="light">
                    {currentTokens.length} called/in progress
                  </Badge>
                </>
              )}
            </Group>
          </Stack>
          <Group gap="xs" className={styles.displayCommandActions}>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconDeviceTv size={14} />}
              onClick={() => setActiveTab("displays")}
            >
              Displays
            </Button>
            {canManageTokens && (
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconTicket size={14} />}
                onClick={() => setActiveTab("tokens")}
              >
                Tokens
              </Button>
            )}
            {canBroadcast && (
              <Button
                size="xs"
                variant="light"
                color="blue"
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
                        <Badge size="xs" variant="light">
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
                          <Group gap={4}>
                            <Badge size="xs" variant="light">
                              {target.count}
                            </Badge>
                            <Tooltip label={`Open ${target.label}`}>
                              <ActionIcon
                                component="a"
                                href={target.href}
                                variant="subtle"
                                aria-label={`Open ${target.label}`}
                              >
                                <IconExternalLink size={14} />
                              </ActionIcon>
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
                    size="xs"
                    variant={activeTab === "displays" ? "filled" : "light"}
                    color="teal"
                    leftSection={<IconDeviceTv size={14} />}
                    onClick={() => setActiveTab("displays")}
                    fullWidth
                  >
                    Display registry
                  </Button>
                  {canManageTokens && (
                    <Button
                      size="xs"
                      variant={activeTab === "tokens" ? "filled" : "light"}
                      color="orange"
                      leftSection={<IconTicket size={14} />}
                      onClick={() => setActiveTab("tokens")}
                      fullWidth
                    >
                      Token operations
                    </Button>
                  )}
                  {canBroadcast && (
                    <Button
                      size="xs"
                      variant={activeTab === "announcements" ? "filled" : "light"}
                      color="blue"
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
      notifications.show({ title: "Success", message: "Display created", color: "success" });
      close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create display", color: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTvDisplayRequest }) =>
      tvDisplaysService.updateTvDisplay(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      notifications.show({ title: "Success", message: "Display updated", color: "success" });
      close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to update display", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.deleteTvDisplay(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tv-displays"] });
      notifications.show({ title: "Success", message: "Display deleted", color: "success" });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to delete display", color: "danger" });
    },
  });

  const columns: Column<TvDisplay>[] = [
    { key: "location_name", label: "Location", render: (row) => row.location_name },
    {
      key: "display_type",
      label: "Type",
      render: (row) => (
        <Badge variant="light" color="primary">
          {displayTypeLabels[row.display_type] || row.display_type}
        </Badge>
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
              <Badge size="xs" variant="light">
                {target.appCode}
              </Badge>
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
            <Badge key={lang} size="xs" variant="outline">
              {lang.toUpperCase()}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: "show_patient_name",
      label: "Options",
      render: (row) => (
        <Group gap="xs">
          {row.show_patient_name && (
            <Badge size="xs" color="orange">
              Names enabled
            </Badge>
          )}
          {!row.show_patient_name && (
            <Badge size="xs" color="success">
              Token-only
            </Badge>
          )}
          {row.show_wait_time && (
            <Badge size="xs" color="primary">
              Wait
            </Badge>
          )}
          {row.announcement_enabled && (
            <Badge size="xs" color="orange">
              Announcements
            </Badge>
          )}
        </Group>
      ),
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
                <ActionIcon
                  component="a"
                  href={target.href}
                  variant="subtle"
                  aria-label={`Open ${target.label}`}
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {canUpdate && (
              <Tooltip label="Edit">
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    setSelectedDisplay(row);
                    displayForm.reset(tvDisplayToForm(row));
                    open();
                  }}
                  aria-label="Edit"
                >
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip label="Delete">
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  onClick={() => deleteMutation.mutate(row.id)}
                  aria-label="Delete"
                >
                  <IconTrash size={16} />
                </ActionIcon>
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
                  description="Public token boards remain token-only; enable only for controlled team-room displays."
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
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
              <Button variant="subtle" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {selectedDisplay ? "Update" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Queue Tokens Tab
// ══════════════════════════════════════════════════════════

function QueueTokensTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<QueueTokenStatus | null>(null);
  const [generateOpened, { open: openGenerate, close: closeGenerate }] = useDisclosure(false);
  const tokenForm = useForm<QueueTokenFormInput>({
    resolver: zodResolver(queueTokenFormSchema),
    defaultValues: defaultQueueTokenFormValues,
  });
  const today = todayIsoDate();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => tvDisplaysService.listDepartments(),
  });

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
    refetchInterval: QUEUE_REFRESH_MS,
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["queue-tokens", today, selectedDepartment, selectedStatus],
    queryFn: () =>
      tvDisplaysService.listQueueTokens({
        department_id: selectedDepartment || undefined,
        status: selectedStatus || undefined,
        date: today,
      }),
    refetchInterval: QUEUE_REFRESH_MS,
  });

  const { data: queueState } = useQuery({
    queryKey: ["queue-state", selectedDepartment],
    queryFn: () =>
      selectedDepartment ? tvDisplaysService.getQueueState(selectedDepartment) : null,
    enabled: !!selectedDepartment,
    refetchInterval: QUEUE_REFRESH_MS,
  });

  const opdDisplays = useMemo(
    () => displays.filter((display) => display.display_type === "opd_queue"),
    [displays],
  );
  const queueSummary = useMemo(() => {
    const currentTokens = tokens.filter(
      (token) => token.status === "called" || token.status === "in_progress",
    );
    const waitingTokens = tokens.filter((token) => token.status === "waiting");
    const completedTokens = tokens.filter((token) => token.status === "completed");
    const noShowTokens = tokens.filter((token) => token.status === "no_show");
    const scopedDisplays = selectedDepartment
      ? opdDisplays.filter(
          (display) => !display.department_id || display.department_id === selectedDepartment,
        )
      : opdDisplays;
    return {
      completedTokens,
      currentTokens,
      noShowTokens,
      scopedDisplays,
      waitingTokens,
    };
  }, [opdDisplays, selectedDepartment, tokens]);
  const departmentLanes = useMemo<DepartmentQueueLane[]>(() => {
    const lanes = new Map<string, DepartmentQueueLane>();

    function laneFor(departmentId: string) {
      const existing = lanes.get(departmentId);
      if (existing) return existing;
      const lane: DepartmentQueueLane = {
        currentTokens: [],
        departmentId,
        departmentName: departmentName(departments, departmentId),
        displayCount: opdDisplays.filter(
          (display) => !display.department_id || display.department_id === departmentId,
        ).length,
        nextToken: null,
        nextTokens: [],
        waitingCount: 0,
      };
      lanes.set(departmentId, lane);
      return lane;
    }

    for (const token of tokens) {
      const lane = laneFor(token.department_id);
      if (token.status === "waiting") {
        lane.waitingCount += 1;
        lane.nextTokens.push(token);
        lane.nextToken ??= token;
      }
      if (token.status === "called" || token.status === "in_progress") {
        lane.currentTokens.push(token);
      }
    }

    return [...lanes.values()].sort((left, right) =>
      left.departmentName.localeCompare(right.departmentName),
    );
  }, [departments, opdDisplays, tokens]);

  const generateMutation = useMutation({
    mutationFn: (data: CreateQueueTokenRequest) => tvDisplaysService.createQueueToken(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      notifications.show({
        title: "Token Generated",
        message: `Token ${result.token_number} created successfully`,
        color: "success",
      });
      closeGenerate();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to generate token", color: "danger" });
    },
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.callQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({ title: "Success", message: "Token called", color: "success" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.completeQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({ title: "Success", message: "Token completed", color: "success" });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.noShowQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({
        title: "Success",
        message: "Token marked as no-show",
        color: "warning",
      });
    },
  });

  const columns: Column<QueueToken>[] = [
    {
      key: "token_number",
      label: "Token",
      render: (row) => (
        <Badge size="lg" variant="filled">
          {row.token_number}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge color={statusColors[row.status] || "slate"}>{tokenStatusLabel(row.status)}</Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => <Badge variant="outline">{row.priority}</Badge>,
    },
    {
      key: "department_id",
      label: "Department",
      render: (row) => departmentName(departments, row.department_id),
    },
    {
      key: "called_at",
      label: "Called At",
      render: (row) => (row.called_at ? new Date(row.called_at).toLocaleTimeString() : "-"),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => new Date(row.created_at).toLocaleTimeString(),
    },
    {
      key: "id",
      label: "Actions",
      render: (row) => {
        if (!canManage) return null;
        return (
          <Group gap="xs">
            {row.status === "waiting" && (
              <Tooltip label="Call">
                <ActionIcon
                  variant="filled"
                  color="primary"
                  onClick={() => callMutation.mutate(row.id)}
                  loading={callMutation.isPending}
                  aria-label="Play"
                >
                  <IconPlayerPlay size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {(row.status === "called" || row.status === "in_progress") && (
              <>
                <Tooltip label="Complete">
                  <ActionIcon
                    variant="filled"
                    color="success"
                    onClick={() => completeMutation.mutate(row.id)}
                    loading={completeMutation.isPending}
                    aria-label="Confirm"
                  >
                    <IconCheck size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="No Show">
                  <ActionIcon
                    variant="filled"
                    color="danger"
                    onClick={() => noShowMutation.mutate(row.id)}
                    loading={noShowMutation.isPending}
                    aria-label="User Off"
                  >
                    <IconUserOff size={16} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        );
      },
    },
  ];

  const handleGenerateSubmit = tokenForm.handleSubmit((values) => {
    generateMutation.mutate(queueTokenFormToRequest(values));
  });

  return (
    <>
      <Box className={styles.queueMetricGrid} mb="md">
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Now Serving
          </Text>
          <Text size="xl" fw={700}>
            {queueSummary.currentTokens.map((token) => token.token_number).join(", ") || "-"}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Waiting
          </Text>
          <Text size="xl" fw={700} c="primary">
            {queueSummary.waitingTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Completed Today
          </Text>
          <Text size="xl" fw={700} c="success">
            {queueSummary.completedTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            No Shows
          </Text>
          <Text size="xl" fw={700} c="danger">
            {queueSummary.noShowTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Linked Displays
          </Text>
          <Text size="xl" fw={700}>
            {queueSummary.scopedDisplays.length}
          </Text>
        </Box>
      </Box>

      {departmentLanes.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} mb="md" spacing="sm">
          {departmentLanes.map((lane) => {
            const activeToken = lane.currentTokens[0] ?? null;
            const nextToken = lane.nextToken;
            return (
              <Box key={lane.departmentId} className={styles.queueLane}>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={700}>{lane.departmentName}</Text>
                    <Text size="xs" c="dimmed">
                      medbrains://tv/queue?department={lane.departmentId}
                    </Text>
                  </Stack>
                  <Badge color={lane.displayCount > 0 ? "primary" : "orange"} variant="light">
                    {lane.displayCount} displays
                  </Badge>
                </Group>
                <Group mt="sm" justify="space-between" align="flex-end" gap="sm">
                  <Group gap="xs">
                    <Badge color={lane.currentTokens.length > 0 ? "success" : "slate"}>
                      Now {lane.currentTokens.map((token) => token.token_number).join(", ") || "-"}
                    </Badge>
                    <Badge color="primary" variant="light">
                      Waiting {lane.waitingCount}
                    </Badge>
                    <Badge color="slate" variant="light">
                      Next{" "}
                      {lane.nextTokens
                        .slice(0, 3)
                        .map((token) => token.token_number)
                        .join(", ") || "-"}
                    </Badge>
                  </Group>
                  {canManage && (
                    <Group gap={4}>
                      {nextToken && (
                        <Tooltip label={`Call ${nextToken.token_number}`}>
                          <ActionIcon
                            variant="light"
                            color="primary"
                            aria-label={`Call token ${nextToken.token_number}`}
                            onClick={() => callMutation.mutate(nextToken.id)}
                            loading={callMutation.isPending}
                          >
                            <IconPlayerPlay size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {activeToken && (
                        <>
                          <Tooltip label={`Complete ${activeToken.token_number}`}>
                            <ActionIcon
                              variant="light"
                              color="success"
                              aria-label={`Complete token ${activeToken.token_number}`}
                              onClick={() => completeMutation.mutate(activeToken.id)}
                              loading={completeMutation.isPending}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={`No-show ${activeToken.token_number}`}>
                            <ActionIcon
                              variant="light"
                              color="danger"
                              aria-label={`Mark token ${activeToken.token_number} no-show`}
                              onClick={() => noShowMutation.mutate(activeToken.id)}
                              loading={noShowMutation.isPending}
                            >
                              <IconUserOff size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  )}
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      {queueState && (
        <SimpleGrid cols={4} mb="md">
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Current Token
            </Text>
            <Text size="xl" fw={700}>
              {queueState.current_token?.token_number || "-"}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Waiting
            </Text>
            <Text size="xl" fw={700} c="primary">
              {queueState.waiting_count}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Completed Today
            </Text>
            <Text size="xl" fw={700} c="success">
              {queueState.completed_count}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Next Up
            </Text>
            <Text size="lg">
              {queueState.next_tokens
                .slice(0, 3)
                .map((t) => t.token_number)
                .join(", ") || "-"}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Filters */}
      {generateOpened && (
        <Box className={styles.generatePanel} mb="md">
          <form onSubmit={handleGenerateSubmit}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Text fw={700}>Generate queue token</Text>
                  <Text size="xs" c="dimmed">
                    {selectedDepartment
                      ? departmentName(departments, selectedDepartment)
                      : "Select a department before issuing a token"}
                  </Text>
                </Stack>
                <Button type="button" variant="subtle" size="xs" onClick={closeGenerate}>
                  Close
                </Button>
              </Group>
              <Group align="flex-start">
                <Controller
                  control={tokenForm.control}
                  name="department_id"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Department"
                      data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={fieldState.error?.message}
                      required
                      className={styles.tokenFormField}
                    />
                  )}
                />
                <TextInput
                  label="Patient ID"
                  placeholder="Optional"
                  error={tokenForm.formState.errors.patient_id?.message}
                  className={styles.tokenFormField}
                  {...tokenForm.register("patient_id")}
                />
                <TextInput
                  label="Doctor ID"
                  placeholder="Optional"
                  error={tokenForm.formState.errors.doctor_id?.message}
                  className={styles.tokenFormField}
                  {...tokenForm.register("doctor_id")}
                />
                <Controller
                  control={tokenForm.control}
                  name="priority"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Priority"
                      data={[
                        { value: "normal", label: "Normal" },
                        { value: "elderly", label: "Elderly" },
                        { value: "disabled", label: "Disabled" },
                        { value: "pregnant", label: "Pregnant" },
                        { value: "emergency_referral", label: "Emergency Referral" },
                        { value: "vip", label: "VIP" },
                      ]}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "normal")}
                      error={fieldState.error?.message}
                      className={styles.tokenPriorityField}
                    />
                  )}
                />
                <Button
                  type="submit"
                  loading={generateMutation.isPending}
                  leftSection={<IconTicket size={16} />}
                  className={styles.tokenSubmitButton}
                >
                  Generate
                </Button>
              </Group>
            </Stack>
          </form>
        </Box>
      )}

      <Group mb="md" className={styles.queueToolbar}>
        <Select
          placeholder="Filter by department"
          data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          clearable
          style={{ width: 200 }}
        />
        <Select
          placeholder="Filter by status"
          data={TOKEN_STATUSES}
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(toQueueTokenStatus(value))}
          clearable
          style={{ width: 150 }}
        />
        <Button
          variant="subtle"
          leftSection={<IconRefresh size={16} />}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
            void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
          }}
        >
          Refresh
        </Button>
        <div style={{ flex: 1 }} />
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              tokenForm.reset({
                ...defaultQueueTokenFormValues,
                department_id: selectedDepartment ?? "",
              });
              generateOpened ? closeGenerate() : openGenerate();
            }}
          >
            {generateOpened ? "Hide Generator" : "Generate Token"}
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={tokens}
        loading={isLoading}
        rowKey={(row) => row.id}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={58}
        tableMaxHeight="calc(100vh - 500px)"
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Announcements Tab
// ══════════════════════════════════════════════════════════

function AnnouncementsTab({ canBroadcast }: { canBroadcast: boolean }) {
  const announcementForm = useForm<TvAnnouncementFormInput>({
    resolver: zodResolver(tvAnnouncementFormSchema),
    defaultValues: defaultTvAnnouncementFormValues,
  });
  const priority = announcementForm.watch("priority");
  const message = announcementForm.watch("message");

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: BroadcastAnnouncementRequest) =>
      tvDisplaysService.broadcastAnnouncement(data),
    onSuccess: () => {
      notifications.show({
        title: "Announcement Sent",
        message: "Announcement has been broadcast to all displays",
        color: "success",
      });
      announcementForm.reset(defaultTvAnnouncementFormValues);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to broadcast announcement",
        color: "danger",
      });
    },
  });

  const handleBroadcast = announcementForm.handleSubmit((values) => {
    broadcastMutation.mutate(tvAnnouncementFormToRequest(values));
  });

  return (
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="md">
          <Text fw={600}>Broadcast Announcement</Text>
          <Textarea
            label="Message"
            placeholder="Enter announcement message..."
            rows={4}
            error={announcementForm.formState.errors.message?.message}
            disabled={!canBroadcast}
            {...announcementForm.register("message")}
          />
          <Group>
            <Controller
              control={announcementForm.control}
              name="priority"
              render={({ field, fieldState }) => (
                <Select
                  label="Priority"
                  data={ANNOUNCEMENT_PRIORITIES}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "info")}
                  error={fieldState.error?.message}
                  style={{ width: 150 }}
                  disabled={!canBroadcast}
                />
              )}
            />
            <Controller
              control={announcementForm.control}
              name="display_ids"
              render={({ field, fieldState }) => (
                <MultiSelect
                  label="Target Displays"
                  placeholder="All displays"
                  data={displays.map((d: TvDisplay) => ({
                    value: d.id,
                    label: d.location_name,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  style={{ flex: 1 }}
                  disabled={!canBroadcast}
                />
              )}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              leftSection={<IconBell size={16} />}
              onClick={() => {
                void handleBroadcast();
              }}
              loading={broadcastMutation.isPending}
              disabled={!canBroadcast || !message.trim()}
              color={
                priority === "emergency" ? "danger" : priority === "warning" ? "orange" : "primary"
              }
            >
              {priority === "emergency" ? "Send Emergency Alert" : "Broadcast"}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Priority descriptions */}
      <SimpleGrid cols={3}>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge color="primary">Info</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            General announcements displayed in rotation with queue information.
          </Text>
        </Card>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge color="orange">Warning</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Important notices that require attention. Displayed more prominently.
          </Text>
        </Card>
        <Card withBorder p="md">
          <Group gap="sm">
            <Badge color="danger">Emergency</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Critical alerts that take over the entire display until dismissed.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export default TvDisplaysPage;
