// IPD RoomBedTab — split from housekeeping.tsx (pure move).

import { Group, Select, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CleaningTask,
  CleaningTaskStatusType,
  CreateCleaningTaskRequest,
  CreateTurnaroundRequest,
  RoomTurnaround,
} from "@medbrains/types";
import { IconCheck, IconPlus, IconWash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, Modal } from "@/components/ui";
import { housekeepingService } from "@/services/housekeeping.service";
import { AREA_TYPES } from "./shared";

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

export function RoomBedTab({
  canCreate,
  canManage,
  canPerform,
  canListTurnaround,
  canManageTurnaround,
}: {
  canCreate: boolean;
  canManage: boolean;
  /** `housekeeping.tasks.perform` — start/complete own tasks (the server enforces "own"). */
  canPerform: boolean;
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
    onError: (e: Error) =>
      notifications.show({ title: "Task not updated", message: e.message, color: "danger" }),
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
            render: (r: CleaningTask) =>
              r.assigned_to_me ? "You" : (r.assigned_to_name ?? r.assigned_to ?? "Unassigned"),
          },
          {
            key: "status",
            label: "Status",
            render: (r: CleaningTask) => (
              <Badge tone={taskStatusColors[r.status]}>{r.status}</Badge>
            ),
          },
          ...(canManage || canPerform
            ? [
                {
                  key: "actions" as const,
                  label: "Actions",
                  render: (r: CleaningTask) => (
                    <Group gap={4}>
                      {r.status === "pending" &&
                        (canManage || !r.assigned_to || r.assigned_to_me) && (
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
                      {r.status === "in_progress" && (canManage || r.assigned_to_me) && (
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
                      {r.status === "completed" && canManage && (
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
      <Modal opened={taskDrawer} onClose={taskDrawerH.close} title="New Cleaning Task" fullScreen>
        <Stack>
          <Select
            label="Area Type"
            data={AREA_TYPES}
            value={taskForm.area_type}
            onChange={(v) => setTaskForm({ ...taskForm, area_type: v ?? "ward" })}
          />
          <EmployeeSearchSelect
            label="Assigned to"
            value={taskForm.assigned_to ?? ""}
            onChange={(id) => setTaskForm({ ...taskForm, assigned_to: id || undefined })}
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
      </Modal>

      {/* Create Turnaround Drawer */}
      <Modal
        opened={turnaroundDrawer}
        onClose={turnaroundDrawerH.close}
        title="Record Turnaround"
        fullScreen
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
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2: Cleaning Schedules + Pest Control
// ══════════════════════════════════════════════════════════
