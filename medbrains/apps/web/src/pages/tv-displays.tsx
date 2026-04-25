import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  SimpleGrid,
  Card,
  Switch,
  Tooltip,
  MultiSelect,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDeviceTv,
  IconTicket,
  IconBell,
  IconCheck,
  IconRefresh,
  IconPlayerPlay,
  IconUserOff,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  TvDisplay,
  QueueToken,
  CreateTvDisplayRequest,
  UpdateTvDisplayRequest,
  CreateQueueTokenRequest,
  BroadcastAnnouncementRequest,
  DepartmentRow,
  QueueTokenStatus,
  QueuePriority,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import type { Column } from "../components/DataTable";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Constants ──────────────────────────────────────────

const DISPLAY_TYPES = [
  { value: "opd_queue", label: "OPD Queue Display" },
  { value: "pharmacy_queue", label: "Pharmacy Queue" },
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
  lab_queue: "Lab",
  radiology_queue: "Radiology",
  bed_status: "Bed Status",
  emergency_triage: "ER Triage",
  digital_signage: "Signage",
  dashboard: "Dashboard",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function TvDisplaysPage() {
  useRequirePermission(P.ADMIN.TV_DISPLAYS.LIST);

  const canCreate = useHasPermission(P.ADMIN.TV_DISPLAYS.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.TV_DISPLAYS.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.TV_DISPLAYS.DELETE);
  const canManageTokens = useHasPermission(P.ADMIN.TV_DISPLAYS.TOKENS);
  const canBroadcast = useHasPermission(P.ADMIN.TV_DISPLAYS.BROADCAST);

  return (
    <div>
      <PageHeader title="TV Displays & Queue" subtitle="Manage TV displays, queue tokens, and announcements" />
      <Tabs defaultValue="displays">
        <Tabs.List>
          <Tabs.Tab value="displays" leftSection={<IconDeviceTv size={16} />}>Displays</Tabs.Tab>
          <Tabs.Tab value="tokens" leftSection={<IconTicket size={16} />}>Queue Tokens</Tabs.Tab>
          <Tabs.Tab value="announcements" leftSection={<IconBell size={16} />}>Announcements</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="displays" pt="md">
          <DisplaysTab canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
        </Tabs.Panel>
        <Tabs.Panel value="tokens" pt="md">
          <QueueTokensTab canManage={canManageTokens} />
        </Tabs.Panel>
        <Tabs.Panel value="announcements" pt="md">
          <AnnouncementsTab canBroadcast={canBroadcast} />
        </Tabs.Panel>
      </Tabs>
    </div>
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

  const { data: displays = [], isLoading } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => api.listTvDisplays(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTvDisplayRequest) => api.createTvDisplay(data),
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
    mutationFn: ({ id, data }: { id: string; data: UpdateTvDisplayRequest }) => api.updateTvDisplay(id, data),
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
    mutationFn: (id: string) => api.deleteTvDisplay(id),
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
          {row.show_patient_name && <Badge size="xs" color="success">Name</Badge>}
          {row.show_wait_time && <Badge size="xs" color="primary">Wait</Badge>}
          {row.announcement_enabled && <Badge size="xs" color="orange">Announcements</Badge>}
        </Group>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (row) => (
        <Group gap="xs">
          {canUpdate && (
            <Tooltip label="Edit">
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setSelectedDisplay(row);
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
      ),
    },
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateTvDisplayRequest = {
      location_name: formData.get("location_name") as string,
      display_type: formData.get("display_type") as string,
      department_id: formData.get("department_id") as string || undefined,
      doctors_per_screen: Number(formData.get("doctors_per_screen")) || 4,
      show_patient_name: formData.get("show_patient_name") === "on",
      show_wait_time: formData.get("show_wait_time") === "on",
      language: (formData.getAll("language") as string[]).length > 0
        ? formData.getAll("language") as string[]
        : ["en"],
      announcement_enabled: formData.get("announcement_enabled") === "on",
      scroll_speed: Number(formData.get("scroll_speed")) || 5,
    };

    if (selectedDisplay) {
      updateMutation.mutate({ id: selectedDisplay.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setSelectedDisplay(null);
              open();
            }}
          >
            Add Display
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={displays}
        loading={isLoading}
        rowKey={(row) => row.id}
      />

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
              name="location_name"
              label="Location Name"
              placeholder="e.g., OPD Waiting Hall"
              defaultValue={selectedDisplay?.location_name}
              required
            />
            <Select
              name="display_type"
              label="Display Type"
              data={DISPLAY_TYPES}
              defaultValue={selectedDisplay?.display_type || "opd_queue"}
              required
            />
            <Select
              name="department_id"
              label="Department"
              placeholder="All departments"
              data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
              defaultValue={selectedDisplay?.department_id || undefined}
              clearable
            />
            <NumberInput
              name="doctors_per_screen"
              label="Doctors Per Screen"
              min={1}
              max={8}
              defaultValue={selectedDisplay?.doctors_per_screen ?? 4}
            />
            <MultiSelect
              name="language"
              label="Languages"
              data={LANGUAGES}
              defaultValue={selectedDisplay?.language || ["en"]}
            />
            <NumberInput
              name="scroll_speed"
              label="Scroll Speed (seconds)"
              min={1}
              max={30}
              defaultValue={selectedDisplay?.scroll_speed ?? 5}
            />
            <Switch
              name="show_patient_name"
              label="Show Patient Name"
              defaultChecked={selectedDisplay?.show_patient_name ?? false}
            />
            <Switch
              name="show_wait_time"
              label="Show Wait Time"
              defaultChecked={selectedDisplay?.show_wait_time ?? true}
            />
            <Switch
              name="announcement_enabled"
              label="Enable Announcements"
              defaultChecked={selectedDisplay?.announcement_enabled ?? true}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={close}>Cancel</Button>
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
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [generateOpened, { open: openGenerate, close: closeGenerate }] = useDisclosure(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["queue-tokens", selectedDepartment, selectedStatus],
    queryFn: () =>
      api.listQueueTokens({
        department_id: selectedDepartment || undefined,
        status: (selectedStatus as QueueTokenStatus) || undefined,
        date: new Date().toISOString().split("T")[0],
      }),
  });

  const { data: queueState } = useQuery({
    queryKey: ["queue-state", selectedDepartment],
    queryFn: () => (selectedDepartment ? api.getQueueState(selectedDepartment) : null),
    enabled: !!selectedDepartment,
  });

  const generateMutation = useMutation({
    mutationFn: (data: CreateQueueTokenRequest) => api.createQueueToken(data),
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
    mutationFn: (id: string) => api.callQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({ title: "Success", message: "Token called", color: "success" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({ title: "Success", message: "Token completed", color: "success" });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => api.noShowQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      notifications.show({ title: "Success", message: "Token marked as no-show", color: "warning" });
    },
  });

  const columns: Column<QueueToken>[] = [
    {
      key: "token_number",
      label: "Token",
      render: (row) => <Badge size="lg" variant="filled">{row.token_number}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge color={statusColors[row.status] || "slate"}>{row.status}</Badge>
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
      render: (row) => {
        const dept = departments.find((d: DepartmentRow) => d.id === row.department_id);
        return dept?.name || row.department_id;
      },
    },
    {
      key: "called_at",
      label: "Called At",
      render: (row) =>
        row.called_at ? new Date(row.called_at).toLocaleTimeString() : "-",
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

  const handleGenerateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    generateMutation.mutate({
      department_id: formData.get("department_id") as string,
      patient_id: formData.get("patient_id") as string || undefined,
      doctor_id: formData.get("doctor_id") as string || undefined,
      priority: ((formData.get("priority") as string) || "normal") as QueuePriority,
    });
  };

  return (
    <>
      {/* Queue State Summary */}
      {queueState && (
        <SimpleGrid cols={4} mb="md">
          <Card withBorder>
            <Text size="sm" c="dimmed">Current Token</Text>
            <Text size="xl" fw={700}>
              {queueState.current_token?.token_number || "-"}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">Waiting</Text>
            <Text size="xl" fw={700} c="primary">{queueState.waiting_count}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">Completed Today</Text>
            <Text size="xl" fw={700} c="success">{queueState.completed_count}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">Next Up</Text>
            <Text size="lg">
              {queueState.next_tokens.slice(0, 3).map((t) => t.token_number).join(", ") || "-"}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Filters */}
      <Group mb="md">
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
          onChange={setSelectedStatus}
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
          <Button leftSection={<IconPlus size={16} />} onClick={openGenerate}>
            Generate Token
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={tokens}
        loading={isLoading}
        rowKey={(row) => row.id}
      />

      {/* Generate Token Drawer */}
      <Drawer
        opened={generateOpened}
        onClose={closeGenerate}
        title="Generate Queue Token"
        position="right"
        size="md"
      >
        <form onSubmit={handleGenerateSubmit}>
          <Stack gap="md">
            <Select
              name="department_id"
              label="Department"
              data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
              required
            />
            <TextInput name="patient_id" label="Patient ID (optional)" placeholder="Leave blank for walk-in" />
            <TextInput name="doctor_id" label="Doctor ID (optional)" placeholder="Leave blank for any doctor" />
            <Select
              name="priority"
              label="Priority"
              data={[
                { value: "normal", label: "Normal" },
                { value: "elderly", label: "Elderly" },
                { value: "disabled", label: "Disabled" },
                { value: "pregnant", label: "Pregnant" },
                { value: "emergency_referral", label: "Emergency Referral" },
                { value: "vip", label: "VIP" },
              ]}
              defaultValue="normal"
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={closeGenerate}>Cancel</Button>
              <Button type="submit" loading={generateMutation.isPending}>Generate</Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Announcements Tab
// ══════════════════════════════════════════════════════════

function AnnouncementsTab({ canBroadcast }: { canBroadcast: boolean }) {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<string | null>("info");
  const [displayIds, setDisplayIds] = useState<string[]>([]);

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => api.listTvDisplays(),
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: BroadcastAnnouncementRequest) => api.broadcastAnnouncement(data),
    onSuccess: () => {
      notifications.show({
        title: "Announcement Sent",
        message: "Announcement has been broadcast to all displays",
        color: "success",
      });
      setMessage("");
      setPriority("info");
      setDisplayIds([]);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to broadcast announcement", color: "danger" });
    },
  });

  const handleBroadcast = () => {
    if (!message.trim()) {
      notifications.show({ title: "Error", message: "Please enter a message", color: "danger" });
      return;
    }
    broadcastMutation.mutate({
      message: message.trim(),
      priority: (priority || "info") as "info" | "warning" | "emergency",
      display_ids: displayIds.length > 0 ? displayIds : undefined,
    });
  };

  return (
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="md">
          <Text fw={600}>Broadcast Announcement</Text>
          <Textarea
            label="Message"
            placeholder="Enter announcement message..."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            disabled={!canBroadcast}
          />
          <Group>
            <Select
              label="Priority"
              data={ANNOUNCEMENT_PRIORITIES}
              value={priority}
              onChange={setPriority}
              style={{ width: 150 }}
              disabled={!canBroadcast}
            />
            <MultiSelect
              label="Target Displays"
              placeholder="All displays"
              data={displays.map((d: TvDisplay) => ({ value: d.id, label: d.location_name }))}
              value={displayIds}
              onChange={setDisplayIds}
              style={{ flex: 1 }}
              disabled={!canBroadcast}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              leftSection={<IconBell size={16} />}
              onClick={handleBroadcast}
              loading={broadcastMutation.isPending}
              disabled={!canBroadcast || !message.trim()}
              color={priority === "emergency" ? "danger" : priority === "warning" ? "orange" : "primary"}
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
