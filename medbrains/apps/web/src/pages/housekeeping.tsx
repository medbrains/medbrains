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
  CleaningTask,
  CleaningTaskStatusType,
  CreateCleaningTaskRequest,
  CreateTurnaroundRequest,
  LinenCondemnation,
  LinenParLevel,
  RoomTurnaround,
  UpsertParLevelRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBed,
  IconBiohazard,
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
import { SchedulesTab } from "./housekeeping/schedules-tab";
import { AREA_TYPES, LINEN_TYPES } from "./housekeeping/shared";

// ── Constants ──────────────────────────────────────────

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
