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
  CreatePestControlLogRequest,
  CreatePestControlScheduleRequest,
  CreateTurnaroundRequest,
  LinenCondemnation,
  LinenParLevel,
  PestControlLog,
  PestControlSchedule,
  RoomTurnaround,
  UpsertParLevelRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBed,
  IconBiohazard,
  IconBug,
  IconChartBar,
  IconCheck,
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
import { LinenTab } from "./housekeeping/linen-tab";
import { LINEN_TYPES } from "./housekeeping/shared";

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

const turnaroundColor = (mins?: number): BadgeTone => {
  if (!mins) return "neutral";
  if (mins <= 30) return "success";
  if (mins <= 60) return "warning";
  return "danger";
};

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

// Local Badge tone map for contaminationMeta colors (the meta is also used by
// ThemeIcon, so the shared helper keeps Mantine colors and Badges map here).

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
