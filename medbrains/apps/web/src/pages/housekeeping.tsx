import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CleaningAreaType,
  CleaningSchedule,
  CleaningTask,
  CleaningTaskStatusType,
  CreateCleaningScheduleRequest,
  CreateCleaningTaskRequest,
  CreateLaundryBatchRequest,
  CreateLinenItemRequest,
  CreateLinenMovementRequest,
  CreatePestControlLogRequest,
  CreatePestControlScheduleRequest,
  CreateTurnaroundRequest,
  LaundryBatch,
  LinenCondemnation,
  LinenContaminationTypeValue,
  LinenItem,
  LinenMovement,
  LinenParLevel,
  LinenStatusType,
  PestControlLog,
  PestControlSchedule,
  RoomTurnaround,
  UpsertParLevelRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconBiohazard,
  IconBug,
  IconChartBar,
  IconCheck,
  type IconDroplet,
  IconHanger,
  IconPlus,
  IconWash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { housekeepingService } from "@/services/housekeeping.service";
import { BmwTab } from "./housekeeping/bmw-tab";

// ── Constants ──────────────────────────────────────────

const AREA_TYPES: CleaningAreaType[] = [
  "icu",
  "ward",
  "ot",
  "er",
  "lab",
  "pharmacy",
  "corridor",
  "lobby",
  "washroom",
  "kitchen",
  "general",
];

const taskStatusColors: Record<CleaningTaskStatusType, BadgeTone> = {
  pending: "neutral",
  assigned: "primary",
  in_progress: "warning",
  completed: "success",
  verified: "success",
  rejected: "danger",
};

const linenStatusColors: Record<LinenStatusType, BadgeTone> = {
  clean: "success",
  in_use: "primary",
  soiled: "warning",
  washing: "warning",
  condemned: "danger",
};

const turnaroundColor = (mins?: number): BadgeTone => {
  if (!mins) return "neutral";
  if (mins <= 30) return "success";
  if (mins <= 60) return "warning";
  return "danger";
};

const LINEN_TYPES = ["bedsheet", "pillowcover", "blanket", "towel", "gown", "curtain"];

// Dropdown options for categorical fields
const PEST_TYPES = [
  { value: "rodent", label: "Rodents (Rats/Mice)" },
  { value: "cockroach", label: "Cockroaches" },
  { value: "mosquito", label: "Mosquitoes" },
  { value: "flies", label: "Flies" },
  { value: "bed_bugs", label: "Bed Bugs" },
  { value: "ants", label: "Ants" },
  { value: "termites", label: "Termites" },
  { value: "other", label: "Other" },
];

const PEST_TREATMENT_TYPES = [
  { value: "spraying", label: "Spraying" },
  { value: "fogging", label: "Fogging" },
  { value: "baiting", label: "Baiting" },
  { value: "trapping", label: "Trapping" },
  { value: "fumigation", label: "Fumigation" },
  { value: "gel_treatment", label: "Gel Treatment" },
  { value: "inspection", label: "Inspection Only" },
  { value: "other", label: "Other" },
];

// ── BMW Color Codes (per CPCB guidelines) ────────────────

// ── Linen Contamination Colors ───────────────────────────
const CONTAMINATION_TYPES: LinenContaminationTypeValue[] = ["regular", "contaminated", "isolation"];

const contaminationMeta: Record<
  LinenContaminationTypeValue,
  { color: string; label: string; icon: typeof IconDroplet }
> = {
  regular: { color: "success", label: "Normal", icon: IconCheck },
  contaminated: { color: "danger", label: "Contaminated", icon: IconAlertTriangle },
  isolation: { color: "orange", label: "Isolation", icon: IconBiohazard },
};

// Local Badge tone map for contaminationMeta colors (the meta is also used by
// ThemeIcon, so the shared helper keeps Mantine colors and Badges map here).
const CONTAMINATION_BADGE_TONE: Record<string, BadgeTone> = {
  success: "success",
  danger: "danger",
  orange: "warning",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function HousekeepingPage() {
  useRequirePermission(P.HOUSEKEEPING.CLEANING_LIST);

  const canCreateCleaning = useHasPermission(P.HOUSEKEEPING.CLEANING_CREATE);
  const canManageCleaning = useHasPermission(P.HOUSEKEEPING.CLEANING_MANAGE);
  const canListTurnaround = useHasPermission(P.HOUSEKEEPING.TURNAROUND_LIST);
  const canManageTurnaround = useHasPermission(P.HOUSEKEEPING.TURNAROUND_MANAGE);
  const canListPest = useHasPermission(P.HOUSEKEEPING.PEST_CONTROL_LIST);
  const canManagePest = useHasPermission(P.HOUSEKEEPING.PEST_CONTROL_MANAGE);
  const canListLinen = useHasPermission(P.HOUSEKEEPING.LINEN_LIST);
  const canCreateLinen = useHasPermission(P.HOUSEKEEPING.LINEN_CREATE);
  const canManageLinen = useHasPermission(P.HOUSEKEEPING.LINEN_MANAGE);
  const canListLaundry = useHasPermission(P.HOUSEKEEPING.LAUNDRY_LIST);
  const canManageLaundry = useHasPermission(P.HOUSEKEEPING.LAUNDRY_MANAGE);
  const canListBiowaste = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_LIST);
  const canCreateBiowaste = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_CREATE);

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle="Cleaning, room turnaround, pest control, linen & laundry"
      />
      <Tabs defaultValue="room-bed">
        <Tabs.List>
          <Tabs.Tab value="room-bed" leftSection={<IconBed size={16} />}>
            Room & Bed
          </Tabs.Tab>
          <Tabs.Tab value="schedules" leftSection={<IconWash size={16} />}>
            Cleaning Schedules
          </Tabs.Tab>
          <Tabs.Tab value="linen" leftSection={<IconHanger size={16} />}>
            Linen & Laundry
          </Tabs.Tab>
          <Tabs.Tab value="par-audit" leftSection={<IconChartBar size={16} />}>
            Par Levels & Audit
          </Tabs.Tab>
          {canListBiowaste && (
            <Tabs.Tab value="bmw" leftSection={<IconBiohazard size={16} />}>
              BMW
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="room-bed" pt="md">
          <RoomBedTab
            canCreate={canCreateCleaning}
            canManage={canManageCleaning}
            canListTurnaround={canListTurnaround}
            canManageTurnaround={canManageTurnaround}
          />
        </Tabs.Panel>

        <Tabs.Panel value="schedules" pt="md">
          <SchedulesTab
            canCreate={canCreateCleaning}
            canListPest={canListPest}
            canManagePest={canManagePest}
          />
        </Tabs.Panel>

        <Tabs.Panel value="linen" pt="md">
          <LinenTab
            canList={canListLinen}
            canCreate={canCreateLinen}
            canListLaundry={canListLaundry}
            canManageLaundry={canManageLaundry}
          />
        </Tabs.Panel>

        <Tabs.Panel value="par-audit" pt="md">
          <ParAuditTab canList={canListLinen} canManage={canManageLinen} />
        </Tabs.Panel>

        {canListBiowaste && (
          <Tabs.Panel value="bmw" pt="md">
            <BmwTab canCreate={canCreateBiowaste} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1: Room & Bed
// ══════════════════════════════════════════════════════════

function RoomBedTab({
  canCreate,
  canManage,
  canListTurnaround,
  canManageTurnaround,
}: {
  canCreate: boolean;
  canManage: boolean;
  canListTurnaround: boolean;
  canManageTurnaround: boolean;
}) {
  const qc = useQueryClient();
  const [taskDrawer, taskDrawerH] = useDisclosure(false);
  const [turnaroundDrawer, turnaroundDrawerH] = useDisclosure(false);

  // Task form state
  const [taskForm, setTaskForm] = useState<CreateCleaningTaskRequest>({ area_type: "ward" });

  // Turnaround form state
  const [turnaroundForm, setTurnaroundForm] = useState<CreateTurnaroundRequest>({});

  const tasksQ = useQuery({
    queryKey: ["housekeeping", "tasks"],
    queryFn: () => housekeepingService.listCleaningTasks(),
  });
  const turnaroundsQ = useQuery({
    queryKey: ["housekeeping", "turnarounds"],
    queryFn: () => housekeepingService.listTurnarounds(),
    enabled: canListTurnaround,
  });

  const createTaskM = useMutation({
    mutationFn: (data: CreateCleaningTaskRequest) => housekeepingService.createCleaningTask(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "tasks"] });
      taskDrawerH.close();
      notifications.show({
        title: "Task Created",
        message: "Cleaning task created",
        color: "success",
      });
    },
  });

  const updateStatusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      housekeepingService.updateCleaningTaskStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "tasks"] });
    },
  });

  const verifyM = useMutation({
    mutationFn: (id: string) => housekeepingService.verifyCleaningTask(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "tasks"] });
      notifications.show({ title: "Verified", message: "Task verified", color: "teal" });
    },
  });

  const createTurnaroundM = useMutation({
    mutationFn: (data: CreateTurnaroundRequest) => housekeepingService.createTurnaround(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "turnarounds"] });
      turnaroundDrawerH.close();
    },
  });

  const completeTurnaroundM = useMutation({
    mutationFn: (id: string) => housekeepingService.completeTurnaround(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "turnarounds"] });
      notifications.show({
        title: "Room Ready",
        message: "Turnaround completed",
        color: "success",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* Turnarounds */}
      {canListTurnaround && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Room Turnarounds
            </Text>
            {canManageTurnaround && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={turnaroundDrawerH.open}
              >
                Record Turnaround
              </Button>
            )}
          </Group>
          <DataTable
            data={turnaroundsQ.data ?? []}
            loading={turnaroundsQ.isLoading}
            rowKey={(r: RoomTurnaround) => r.id}
            columns={[
              {
                key: "discharge_at",
                label: "Discharged",
                render: (r: RoomTurnaround) =>
                  r.discharge_at ? new Date(r.discharge_at).toLocaleString() : "-",
              },
              {
                key: "cleaned_by",
                label: "Cleaned By",
                render: (r: RoomTurnaround) => r.cleaned_by ?? "-",
              },
              {
                key: "turnaround_minutes",
                label: "TAT (min)",
                render: (r: RoomTurnaround) =>
                  r.turnaround_minutes != null ? (
                    <Badge tone={turnaroundColor(r.turnaround_minutes)}>
                      {r.turnaround_minutes}m
                    </Badge>
                  ) : (
                    "-"
                  ),
              },
              {
                key: "ready_at",
                label: "Ready At",
                render: (r: RoomTurnaround) =>
                  r.ready_at ? (
                    new Date(r.ready_at).toLocaleString()
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  ),
              },
              ...(canManageTurnaround
                ? [
                    {
                      key: "actions" as const,
                      label: "Actions",
                      render: (r: RoomTurnaround) =>
                        !r.ready_at ? (
                          <Tooltip label="Mark Ready">
                            <IconButton
                              tone="success"
                              onClick={() => completeTurnaroundM.mutate(r.id)}
                              aria-label="Confirm"
                            >
                              <IconCheck size={16} />
                            </IconButton>
                          </Tooltip>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      {/* Cleaning Tasks */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Cleaning Tasks
        </Text>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={taskDrawerH.open}
          >
            New Task
          </Button>
        )}
      </Group>
      <DataTable
        data={tasksQ.data ?? []}
        loading={tasksQ.isLoading}
        rowKey={(r: CleaningTask) => r.id}
        columns={[
          { key: "task_date", label: "Date", render: (r: CleaningTask) => r.task_date },
          {
            key: "area_type",
            label: "Area",
            render: (r: CleaningTask) => <Badge variant="outline">{r.area_type}</Badge>,
          },
          {
            key: "assigned_to",
            label: "Assigned To",
            render: (r: CleaningTask) => r.assigned_to ?? "-",
          },
          {
            key: "status",
            label: "Status",
            render: (r: CleaningTask) => (
              <Badge tone={taskStatusColors[r.status]}>{r.status}</Badge>
            ),
          },
          ...(canManage
            ? [
                {
                  key: "actions" as const,
                  label: "Actions",
                  render: (r: CleaningTask) => (
                    <Group gap={4}>
                      {r.status === "pending" && (
                        <Tooltip label="Start">
                          <IconButton
                            tone="primary"
                            onClick={() =>
                              updateStatusM.mutate({ id: r.id, status: "in_progress" })
                            }
                            aria-label="Wash"
                          >
                            <IconWash size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {r.status === "in_progress" && (
                        <Tooltip label="Complete">
                          <IconButton
                            tone="success"
                            onClick={() => updateStatusM.mutate({ id: r.id, status: "completed" })}
                            aria-label="Confirm"
                          >
                            <IconCheck size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {r.status === "completed" && (
                        <Tooltip label="Verify">
                          <IconButton
                            tone="success"
                            onClick={() => verifyM.mutate(r.id)}
                            aria-label="Confirm"
                          >
                            <IconCheck size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Group>
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* Create Task Drawer */}
      <Drawer
        opened={taskDrawer}
        onClose={taskDrawerH.close}
        title="New Cleaning Task"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Area Type"
            data={AREA_TYPES}
            value={taskForm.area_type}
            onChange={(v) => setTaskForm({ ...taskForm, area_type: v ?? "ward" })}
          />
          <TextInput
            label="Assigned To"
            value={taskForm.assigned_to ?? ""}
            onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={taskForm.notes ?? ""}
            onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createTaskM.mutate(taskForm)}
            loading={createTaskM.isPending}
          >
            Create Task
          </Button>
        </Stack>
      </Drawer>

      {/* Create Turnaround Drawer */}
      <Drawer
        opened={turnaroundDrawer}
        onClose={turnaroundDrawerH.close}
        title="Record Turnaround"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Cleaned By"
            value={turnaroundForm.cleaned_by ?? ""}
            onChange={(e) => setTurnaroundForm({ ...turnaroundForm, cleaned_by: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createTurnaroundM.mutate(turnaroundForm)}
            loading={createTurnaroundM.isPending}
          >
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2: Cleaning Schedules + Pest Control
// ══════════════════════════════════════════════════════════

function SchedulesTab({
  canCreate,
  canListPest,
  canManagePest,
}: {
  canCreate: boolean;
  canListPest: boolean;
  canManagePest: boolean;
}) {
  const qc = useQueryClient();
  const [schedDrawer, schedDrawerH] = useDisclosure(false);
  const [pestDrawer, pestDrawerH] = useDisclosure(false);
  const [pestLogDrawer, pestLogDrawerH] = useDisclosure(false);

  const [schedForm, setSchedForm] = useState<CreateCleaningScheduleRequest>({ area_type: "ward" });
  const [pestForm, setPestForm] = useState<CreatePestControlScheduleRequest>({ pest_type: "" });
  const [pestLogForm, setPestLogForm] = useState<CreatePestControlLogRequest>({
    treatment_date: "",
    treatment_type: "",
  });

  const schedulesQ = useQuery({
    queryKey: ["housekeeping", "schedules"],
    queryFn: () => housekeepingService.listCleaningSchedules(),
  });
  const pestSchedulesQ = useQuery({
    queryKey: ["housekeeping", "pest-schedules"],
    queryFn: () => housekeepingService.listPestControlSchedules(),
    enabled: canListPest,
  });
  const pestLogsQ = useQuery({
    queryKey: ["housekeeping", "pest-logs"],
    queryFn: () => housekeepingService.listPestControlLogs(),
    enabled: canListPest,
  });

  const createSchedM = useMutation({
    mutationFn: (data: CreateCleaningScheduleRequest) =>
      housekeepingService.createCleaningSchedule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "schedules"] });
      schedDrawerH.close();
      notifications.show({
        title: "Schedule Created",
        message: "Cleaning schedule created",
        color: "success",
      });
    },
  });

  const createPestM = useMutation({
    mutationFn: (data: CreatePestControlScheduleRequest) =>
      housekeepingService.createPestControlSchedule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "pest-schedules"] });
      pestDrawerH.close();
    },
  });

  const createPestLogM = useMutation({
    mutationFn: (data: CreatePestControlLogRequest) =>
      housekeepingService.createPestControlLog(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "pest-logs"] });
      pestLogDrawerH.close();
    },
  });

  return (
    <Stack gap="lg">
      {/* Cleaning Schedules */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Cleaning Schedules
        </Text>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={schedDrawerH.open}
          >
            New Schedule
          </Button>
        )}
      </Group>
      <DataTable
        data={schedulesQ.data ?? []}
        loading={schedulesQ.isLoading}
        rowKey={(r: CleaningSchedule) => r.id}
        columns={[
          {
            key: "area_type",
            label: "Area",
            render: (r: CleaningSchedule) => <Badge variant="outline">{r.area_type}</Badge>,
          },
          {
            key: "frequency_hours",
            label: "Frequency",
            render: (r: CleaningSchedule) => `Every ${r.frequency_hours}h`,
          },
          {
            key: "is_active",
            label: "Status",
            render: (r: CleaningSchedule) => (
              <Badge tone={r.is_active ? "success" : "neutral"}>
                {r.is_active ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          { key: "notes", label: "Notes", render: (r: CleaningSchedule) => r.notes ?? "-" },
        ]}
      />

      {/* Pest Control */}
      {canListPest && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Pest Control Schedules
            </Text>
            {canManagePest && (
              <Group gap="xs">
                <Button
                  tone="primary"
                  leftSection={<IconPlus size={16} />}
                  size="xs"
                  onClick={pestDrawerH.open}
                >
                  New Schedule
                </Button>
                <Button
                  tone="secondary"
                  leftSection={<IconBug size={16} />}
                  size="xs"
                  onClick={pestLogDrawerH.open}
                >
                  Record Treatment
                </Button>
              </Group>
            )}
          </Group>
          <DataTable
            data={pestSchedulesQ.data ?? []}
            loading={pestSchedulesQ.isLoading}
            rowKey={(r: PestControlSchedule) => r.id}
            columns={[
              {
                key: "pest_type",
                label: "Pest Type",
                render: (r: PestControlSchedule) => r.pest_type,
              },
              {
                key: "frequency_months",
                label: "Frequency",
                render: (r: PestControlSchedule) => `Every ${r.frequency_months} months`,
              },
              {
                key: "last_done",
                label: "Last Done",
                render: (r: PestControlSchedule) => r.last_done ?? "-",
              },
              {
                key: "next_due",
                label: "Next Due",
                render: (r: PestControlSchedule) =>
                  r.next_due ? (
                    <Badge tone={new Date(r.next_due) < new Date() ? "danger" : "success"}>
                      {r.next_due}
                    </Badge>
                  ) : (
                    "-"
                  ),
              },
              {
                key: "vendor_name",
                label: "Vendor",
                render: (r: PestControlSchedule) => r.vendor_name ?? "-",
              },
            ]}
          />

          <Text fw={600} size="lg">
            Pest Control Logs
          </Text>
          <DataTable
            data={pestLogsQ.data ?? []}
            loading={pestLogsQ.isLoading}
            rowKey={(r: PestControlLog) => r.id}
            columns={[
              {
                key: "treatment_date",
                label: "Date",
                render: (r: PestControlLog) => r.treatment_date,
              },
              {
                key: "treatment_type",
                label: "Type",
                render: (r: PestControlLog) => r.treatment_type,
              },
              {
                key: "chemicals_used",
                label: "Chemicals",
                render: (r: PestControlLog) => r.chemicals_used ?? "-",
              },
              {
                key: "certificate_no",
                label: "Certificate",
                render: (r: PestControlLog) => r.certificate_no ?? "-",
              },
              {
                key: "vendor_name",
                label: "Vendor",
                render: (r: PestControlLog) => r.vendor_name ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Drawers */}
      <Drawer
        opened={schedDrawer}
        onClose={schedDrawerH.close}
        title="New Cleaning Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Area Type"
            data={AREA_TYPES}
            value={schedForm.area_type}
            onChange={(v) => setSchedForm({ ...schedForm, area_type: v ?? "ward" })}
          />
          <NumberInput
            label="Frequency (hours)"
            value={schedForm.frequency_hours ?? 24}
            onChange={(v) => setSchedForm({ ...schedForm, frequency_hours: Number(v) })}
            min={1}
          />
          <Textarea
            label="Notes"
            value={schedForm.notes ?? ""}
            onChange={(e) => setSchedForm({ ...schedForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createSchedM.mutate(schedForm)}
            loading={createSchedM.isPending}
          >
            Create Schedule
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pestDrawer}
        onClose={pestDrawerH.close}
        title="New Pest Control Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Pest Type"
            data={PEST_TYPES}
            value={pestForm.pest_type || null}
            onChange={(v) => setPestForm({ ...pestForm, pest_type: v ?? "" })}
            searchable
          />
          <NumberInput
            label="Frequency (months)"
            value={pestForm.frequency_months ?? 3}
            onChange={(v) => setPestForm({ ...pestForm, frequency_months: Number(v) })}
            min={1}
          />
          <TextInput
            label="Vendor Name"
            value={pestForm.vendor_name ?? ""}
            onChange={(e) => setPestForm({ ...pestForm, vendor_name: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={pestForm.notes ?? ""}
            onChange={(e) => setPestForm({ ...pestForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createPestM.mutate(pestForm)}
            loading={createPestM.isPending}
          >
            Create Schedule
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pestLogDrawer}
        onClose={pestLogDrawerH.close}
        title="Record Pest Control Treatment"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Treatment Date"
            type="date"
            value={pestLogForm.treatment_date}
            onChange={(e) => setPestLogForm({ ...pestLogForm, treatment_date: e.target.value })}
          />
          <Select
            label="Treatment Type"
            data={PEST_TREATMENT_TYPES}
            value={pestLogForm.treatment_type || null}
            onChange={(v) => setPestLogForm({ ...pestLogForm, treatment_type: v ?? "" })}
            searchable
          />
          <TextInput
            label="Chemicals Used"
            value={pestLogForm.chemicals_used ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, chemicals_used: e.target.value })}
          />
          <TextInput
            label="Vendor Name"
            value={pestLogForm.vendor_name ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, vendor_name: e.target.value })}
          />
          <TextInput
            label="Certificate No"
            value={pestLogForm.certificate_no ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, certificate_no: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createPestLogM.mutate(pestLogForm)}
            loading={createPestLogM.isPending}
          >
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3: Linen & Laundry
// ══════════════════════════════════════════════════════════

function LinenTab({
  canList,
  canCreate,
  canListLaundry,
  canManageLaundry,
}: {
  canList: boolean;
  canCreate: boolean;
  canListLaundry: boolean;
  canManageLaundry: boolean;
}) {
  const qc = useQueryClient();
  const [linenDrawer, linenDrawerH] = useDisclosure(false);
  const [movementDrawer, movementDrawerH] = useDisclosure(false);
  const [batchDrawer, batchDrawerH] = useDisclosure(false);

  const [contaminationFilter, setContaminationFilter] = useState<string | null>(null);
  const [linenForm, setLinenForm] = useState<CreateLinenItemRequest>({ item_type: "bedsheet" });
  const [movementForm, setMovementForm] = useState<CreateLinenMovementRequest>({
    movement_type: "collect",
  });
  const [batchForm, setBatchForm] = useState<CreateLaundryBatchRequest>({ batch_number: "" });

  const linenQ = useQuery({
    queryKey: ["housekeeping", "linen"],
    queryFn: () => housekeepingService.listLinenItems(),
    enabled: canList,
  });
  const movementsQ = useQuery({
    queryKey: ["housekeeping", "movements"],
    queryFn: () => housekeepingService.listLinenMovements(),
    enabled: canList,
  });
  const batchesQ = useQuery({
    queryKey: ["housekeeping", "batches"],
    queryFn: () => housekeepingService.listLaundryBatches(),
    enabled: canListLaundry,
  });

  const createLinenM = useMutation({
    mutationFn: (data: CreateLinenItemRequest) => housekeepingService.createLinenItem(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "linen"] });
      linenDrawerH.close();
      notifications.show({ title: "Item Added", message: "Linen item created", color: "success" });
    },
  });

  const createMovementM = useMutation({
    mutationFn: (data: CreateLinenMovementRequest) => housekeepingService.createLinenMovement(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "movements"] });
      movementDrawerH.close();
    },
  });

  const createBatchM = useMutation({
    mutationFn: (data: CreateLaundryBatchRequest) => housekeepingService.createLaundryBatch(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "batches"] });
      batchDrawerH.close();
    },
  });

  const completeBatchM = useMutation({
    mutationFn: (id: string) => housekeepingService.completeLaundryBatch(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "batches"] });
      notifications.show({
        title: "Batch Complete",
        message: "Laundry batch completed",
        color: "success",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* Linen Items */}
      {canList && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Linen Items
            </Text>
            {canCreate && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={linenDrawerH.open}
              >
                Add Item
              </Button>
            )}
          </Group>
          <DataTable
            data={linenQ.data ?? []}
            loading={linenQ.isLoading}
            rowKey={(r: LinenItem) => r.id}
            columns={[
              { key: "barcode", label: "Barcode", render: (r: LinenItem) => r.barcode ?? "-" },
              { key: "item_type", label: "Type", render: (r: LinenItem) => r.item_type },
              {
                key: "current_status",
                label: "Status",
                render: (r: LinenItem) => (
                  <Badge tone={linenStatusColors[r.current_status]}>{r.current_status}</Badge>
                ),
              },
              {
                key: "wash_count",
                label: "Washes",
                render: (r: LinenItem) => {
                  const pct = (r.wash_count / r.max_washes) * 100;
                  const tone: BadgeTone = pct > 80 ? "danger" : pct > 50 ? "warning" : "success";
                  return (
                    <Badge tone={tone}>
                      {r.wash_count}/{r.max_washes}
                    </Badge>
                  );
                },
              },
              {
                key: "commissioned_date",
                label: "Commissioned",
                render: (r: LinenItem) => r.commissioned_date ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Linen Movements */}
      {canList && (
        <>
          <Group justify="space-between">
            <Group gap="sm">
              <Text fw={600} size="lg">
                Linen Movements
              </Text>
              <Select
                placeholder="Filter by contamination"
                data={CONTAMINATION_TYPES.map((t) => ({
                  value: t,
                  label: contaminationMeta[t].label,
                }))}
                value={contaminationFilter}
                onChange={setContaminationFilter}
                clearable
                w={200}
                size="xs"
              />
              {contaminationFilter && (
                <Badge
                  tone={
                    CONTAMINATION_BADGE_TONE[
                      contaminationMeta[contaminationFilter as LinenContaminationTypeValue]?.color
                    ] ?? "neutral"
                  }
                  size="sm"
                >
                  {
                    (movementsQ.data ?? []).filter(
                      (m) => m.contamination_type === contaminationFilter,
                    ).length
                  }{" "}
                  record(s)
                </Badge>
              )}
            </Group>
            {canCreate && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={movementDrawerH.open}
              >
                Record Movement
              </Button>
            )}
          </Group>
          <DataTable
            data={
              contaminationFilter
                ? (movementsQ.data ?? []).filter(
                    (m) => m.contamination_type === contaminationFilter,
                  )
                : (movementsQ.data ?? [])
            }
            loading={movementsQ.isLoading}
            rowKey={(r: LinenMovement) => r.id}
            columns={[
              {
                key: "contamination_indicator",
                label: "",
                render: (r: LinenMovement) => {
                  const meta =
                    contaminationMeta[r.contamination_type as LinenContaminationTypeValue];
                  if (!meta) return null;
                  const IconComp = meta.icon;
                  return (
                    <ThemeIcon color={meta.color} variant="light" size="sm" radius="xl">
                      <IconComp size={12} />
                    </ThemeIcon>
                  );
                },
              },
              {
                key: "movement_date",
                label: "Date",
                render: (r: LinenMovement) => new Date(r.movement_date).toLocaleString(),
              },
              {
                key: "movement_type",
                label: "Type",
                render: (r: LinenMovement) => <Badge variant="outline">{r.movement_type}</Badge>,
              },
              { key: "quantity", label: "Qty", render: (r: LinenMovement) => String(r.quantity) },
              {
                key: "weight_kg",
                label: "Weight (kg)",
                render: (r: LinenMovement) => (r.weight_kg != null ? String(r.weight_kg) : "-"),
              },
              {
                key: "contamination_type",
                label: "Contamination",
                render: (r: LinenMovement) => {
                  const meta =
                    contaminationMeta[r.contamination_type as LinenContaminationTypeValue];
                  return meta ? (
                    <Badge
                      tone={CONTAMINATION_BADGE_TONE[meta.color] ?? "neutral"}
                      variant="filled"
                      leftSection={(() => {
                        const I = meta.icon;
                        return <I size={12} />;
                      })()}
                    >
                      {meta.label}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{r.contamination_type}</Badge>
                  );
                },
              },
              {
                key: "recorded_by",
                label: "Recorded By",
                render: (r: LinenMovement) => r.recorded_by ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Laundry Batches */}
      {canListLaundry && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Laundry Batches
            </Text>
            {canManageLaundry && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={batchDrawerH.open}
              >
                New Batch
              </Button>
            )}
          </Group>
          <DataTable
            data={batchesQ.data ?? []}
            loading={batchesQ.isLoading}
            rowKey={(r: LaundryBatch) => r.id}
            columns={[
              {
                key: "batch_number",
                label: "Batch #",
                render: (r: LaundryBatch) => r.batch_number,
              },
              {
                key: "items_count",
                label: "Items",
                render: (r: LaundryBatch) => String(r.items_count),
              },
              {
                key: "total_weight",
                label: "Weight (kg)",
                render: (r: LaundryBatch) =>
                  r.total_weight != null ? String(r.total_weight) : "-",
              },
              {
                key: "contamination_type",
                label: "Type",
                render: (r: LaundryBatch) => (
                  <Badge tone={r.contamination_type === "regular" ? "success" : "danger"}>
                    {r.contamination_type}
                  </Badge>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r: LaundryBatch) => (
                  <Badge tone={r.status === "completed" ? "success" : "primary"}>{r.status}</Badge>
                ),
              },
              ...(canManageLaundry
                ? [
                    {
                      key: "actions" as const,
                      label: "Actions",
                      render: (r: LaundryBatch) =>
                        r.status !== "completed" ? (
                          <Tooltip label="Complete Batch">
                            <IconButton
                              tone="success"
                              onClick={() => completeBatchM.mutate(r.id)}
                              aria-label="Confirm"
                            >
                              <IconCheck size={16} />
                            </IconButton>
                          </Tooltip>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      {/* Drawers */}
      <Drawer
        opened={linenDrawer}
        onClose={linenDrawerH.close}
        title="Add Linen Item"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Item Type"
            data={LINEN_TYPES}
            value={linenForm.item_type}
            onChange={(v) => setLinenForm({ ...linenForm, item_type: v ?? "bedsheet" })}
          />
          <TextInput
            label="Barcode"
            value={linenForm.barcode ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, barcode: e.target.value })}
          />
          <NumberInput
            label="Max Washes"
            value={linenForm.max_washes ?? 150}
            onChange={(v) => setLinenForm({ ...linenForm, max_washes: Number(v) })}
            min={1}
          />
          <TextInput
            label="Commissioned Date"
            type="date"
            value={linenForm.commissioned_date ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, commissioned_date: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={linenForm.notes ?? ""}
            onChange={(e) => setLinenForm({ ...linenForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createLinenM.mutate(linenForm)}
            loading={createLinenM.isPending}
          >
            Add Item
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={movementDrawer}
        onClose={movementDrawerH.close}
        title="Record Linen Movement"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Movement Type"
            data={["collect", "wash", "distribute", "return"]}
            value={movementForm.movement_type}
            onChange={(v) => setMovementForm({ ...movementForm, movement_type: v ?? "collect" })}
          />
          <NumberInput
            label="Quantity"
            value={movementForm.quantity ?? 1}
            onChange={(v) => setMovementForm({ ...movementForm, quantity: Number(v) })}
            min={1}
          />
          <NumberInput
            label="Weight (kg)"
            value={movementForm.weight_kg ?? undefined}
            onChange={(v) =>
              setMovementForm({ ...movementForm, weight_kg: v ? Number(v) : undefined })
            }
            decimalScale={2}
          />
          <Select
            label="Contamination"
            data={["regular", "contaminated", "isolation"]}
            value={movementForm.contamination_type ?? "regular"}
            onChange={(v) =>
              setMovementForm({ ...movementForm, contamination_type: v ?? "regular" })
            }
          />
          <TextInput
            label="Recorded By"
            value={movementForm.recorded_by ?? ""}
            onChange={(e) => setMovementForm({ ...movementForm, recorded_by: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMovementM.mutate(movementForm)}
            loading={createMovementM.isPending}
          >
            Record
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={batchDrawer}
        onClose={batchDrawerH.close}
        title="New Laundry Batch"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Batch Number"
            value={batchForm.batch_number}
            onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
            required
          />
          <NumberInput
            label="Items Count"
            value={batchForm.items_count ?? 0}
            onChange={(v) => setBatchForm({ ...batchForm, items_count: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Total Weight (kg)"
            value={batchForm.total_weight ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, total_weight: v ? Number(v) : undefined })
            }
            decimalScale={2}
          />
          <Select
            label="Contamination"
            data={["regular", "contaminated", "isolation"]}
            value={batchForm.contamination_type ?? "regular"}
            onChange={(v) => setBatchForm({ ...batchForm, contamination_type: v ?? "regular" })}
          />
          <TextInput
            label="Wash Formula"
            value={batchForm.wash_formula ?? ""}
            onChange={(e) => setBatchForm({ ...batchForm, wash_formula: e.target.value })}
          />
          <NumberInput
            label="Temperature (°C)"
            value={batchForm.wash_temperature ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, wash_temperature: v ? Number(v) : undefined })
            }
          />
          <NumberInput
            label="Cycle (min)"
            value={batchForm.cycle_minutes ?? undefined}
            onChange={(v) =>
              setBatchForm({ ...batchForm, cycle_minutes: v ? Number(v) : undefined })
            }
          />
          <TextInput
            label="Operator"
            value={batchForm.operator_name ?? ""}
            onChange={(e) => setBatchForm({ ...batchForm, operator_name: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createBatchM.mutate(batchForm)}
            loading={createBatchM.isPending}
          >
            Start Batch
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4: Par Levels & Audit
// ══════════════════════════════════════════════════════════

function ParAuditTab({ canList, canManage }: { canList: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [parDrawer, parDrawerH] = useDisclosure(false);
  const [parForm, setParForm] = useState<UpsertParLevelRequest>({
    item_type: "bedsheet",
    par_level: 10,
  });

  const parQ = useQuery({
    queryKey: ["housekeeping", "par-levels"],
    queryFn: () => housekeepingService.listParLevels(),
    enabled: canList,
  });
  const condemnQ = useQuery({
    queryKey: ["housekeeping", "condemnations"],
    queryFn: () => housekeepingService.listLinenCondemnations(),
    enabled: canList,
  });

  const upsertParM = useMutation({
    mutationFn: (data: UpsertParLevelRequest) => housekeepingService.upsertParLevel(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "par-levels"] });
      parDrawerH.close();
      notifications.show({
        title: "Par Level Updated",
        message: "Par level saved",
        color: "success",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* Par Levels */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Linen Par Levels
        </Text>
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={parDrawerH.open}
          >
            Set Par Level
          </Button>
        )}
      </Group>
      <DataTable
        data={parQ.data ?? []}
        loading={parQ.isLoading}
        rowKey={(r: LinenParLevel) => r.id}
        columns={[
          { key: "item_type", label: "Item Type", render: (r: LinenParLevel) => r.item_type },
          {
            key: "par_level",
            label: "Par Level",
            render: (r: LinenParLevel) => String(r.par_level),
          },
          {
            key: "current_stock",
            label: "Current Stock",
            render: (r: LinenParLevel) => {
              const tone: BadgeTone =
                r.current_stock <= r.reorder_level
                  ? "danger"
                  : r.current_stock < r.par_level
                    ? "warning"
                    : "success";
              return <Badge tone={tone}>{r.current_stock}</Badge>;
            },
          },
          {
            key: "reorder_level",
            label: "Reorder Level",
            render: (r: LinenParLevel) => String(r.reorder_level),
          },
        ]}
      />

      {/* Condemnations */}
      <Text fw={600} size="lg">
        Linen Condemnations
      </Text>
      <DataTable
        data={condemnQ.data ?? []}
        loading={condemnQ.isLoading}
        rowKey={(r: LinenCondemnation) => r.id}
        columns={[
          {
            key: "condemned_date",
            label: "Date",
            render: (r: LinenCondemnation) => r.condemned_date,
          },
          { key: "reason", label: "Reason", render: (r: LinenCondemnation) => r.reason },
          {
            key: "wash_count_at_condemn",
            label: "Wash Count",
            render: (r: LinenCondemnation) =>
              r.wash_count_at_condemn != null ? String(r.wash_count_at_condemn) : "-",
          },
          {
            key: "replacement_requested",
            label: "Replacement",
            render: (r: LinenCondemnation) =>
              r.replacement_requested ? (
                <Badge tone="primary">Requested</Badge>
              ) : (
                <Badge tone="neutral">No</Badge>
              ),
          },
        ]}
      />

      {/* Par Level Drawer */}
      <Drawer
        opened={parDrawer}
        onClose={parDrawerH.close}
        title="Set Par Level"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Item Type"
            data={LINEN_TYPES}
            value={parForm.item_type}
            onChange={(v) => setParForm({ ...parForm, item_type: v ?? "bedsheet" })}
          />
          <NumberInput
            label="Par Level"
            value={parForm.par_level}
            onChange={(v) => setParForm({ ...parForm, par_level: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Current Stock"
            value={parForm.current_stock ?? 0}
            onChange={(v) => setParForm({ ...parForm, current_stock: Number(v) })}
            min={0}
          />
          <NumberInput
            label="Reorder Level"
            value={parForm.reorder_level ?? 0}
            onChange={(v) => setParForm({ ...parForm, reorder_level: Number(v) })}
            min={0}
          />
          <Button
            tone="primary"
            onClick={() => upsertParM.mutate(parForm)}
            loading={upsertParM.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5: Biomedical Waste (BMW)
// ══════════════════════════════════════════════════════════
