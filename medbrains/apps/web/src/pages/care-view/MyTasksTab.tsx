import { Group, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MedAdminItem, MyTasksResponse, NurseTaskItem } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, IconButton } from "@/components/ui";
import { careViewService } from "@/services/careView.service";

export function MyTasksTab({ wardId, canManage }: { wardId: string | null; canManage: boolean }) {
  const [segment, setSegment] = useState("medications");

  const { data, isLoading } = useQuery<MyTasksResponse>({
    queryKey: ["care-view", "my-tasks", wardId],
    queryFn: () => careViewService.myTasks({ ward_id: wardId ?? undefined }),
    refetchInterval: 30_000,
  });

  const medicationTasks = data?.medication_tasks ?? [];
  const nursingTasks = data?.nursing_tasks ?? [];

  return (
    <>
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        data={[
          { value: "medications", label: `Medications (${medicationTasks.length})` },
          { value: "nursing", label: `Nursing Tasks (${nursingTasks.length})` },
        ]}
      />

      {segment === "medications" ? (
        <MedicationsTable items={medicationTasks} loading={isLoading} />
      ) : (
        <NursingTasksTable items={nursingTasks} loading={isLoading} canManage={canManage} />
      )}
    </>
  );
}

function MedicationsTable({ items, loading }: { items: MedAdminItem[]; loading: boolean }) {
  const columns: Column<MedAdminItem>[] = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => <Text size="sm">{row.patient_name}</Text>,
    },
    {
      key: "bed_name",
      label: "Bed",
      render: (row) => <Text size="sm">{row.bed_name ?? "—"}</Text>,
    },
    {
      key: "drug_name",
      label: "Drug",
      render: (row) => (
        <Group gap={4}>
          <Text size="sm">{row.drug_name}</Text>
          {row.is_high_alert && (
            <Badge size="xs" tone="danger" variant="filled">
              HIGH ALERT
            </Badge>
          )}
        </Group>
      ),
    },
    { key: "dose", label: "Dose", render: (row) => <Text size="sm">{row.dose}</Text> },
    { key: "route", label: "Route", render: (row) => <Text size="sm">{row.route}</Text> },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (row) => (
        <Text size="sm" c={row.is_overdue ? "danger" : undefined}>
          {new Date(row.scheduled_at).toLocaleTimeString()}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge size="sm" tone={row.is_overdue ? "danger" : "warning"}>
          {row.is_overdue ? "Overdue" : "Pending"}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={items} loading={loading} rowKey={(row) => row.mar_id} />
  );
}

function NursingTasksTable({
  items,
  loading,
  canManage,
}: {
  items: NurseTaskItem[];
  loading: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: (taskId: string) => careViewService.completeTask(taskId),
    onSuccess: () => {
      notifications.show({ title: "Task completed", message: "", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["care-view", "my-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["care-view", "ward-grid"] });
    },
  });

  const columns: Column<NurseTaskItem>[] = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => <Text size="sm">{row.patient_name}</Text>,
    },
    {
      key: "bed_name",
      label: "Bed",
      render: (row) => <Text size="sm">{row.bed_name ?? "—"}</Text>,
    },
    {
      key: "description",
      label: "Task",
      render: (row) => (
        <Text size="sm" lineClamp={2}>
          {row.description}
        </Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <Badge size="xs" variant="light" tone="primary">
          {row.category ?? "—"}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => (
        <Badge
          size="xs"
          tone={
            row.priority === "stat" ? "danger" : row.priority === "urgent" ? "warning" : "neutral"
          }
        >
          {row.priority}
        </Badge>
      ),
    },
    {
      key: "due_at",
      label: "Due",
      render: (row) => (
        <Text size="sm" c={row.is_overdue ? "danger" : undefined}>
          {row.due_at ? new Date(row.due_at).toLocaleTimeString() : "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge size="sm" tone={row.is_overdue ? "danger" : "warning"}>
          {row.is_overdue ? "Overdue" : "Pending"}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      label: "",
      render: (row) => (
        <Tooltip label="Complete task">
          <IconButton
            size="sm"
            tone="success"
            loading={completeMutation.isPending}
            onClick={() => completeMutation.mutate(row.task_id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </IconButton>
        </Tooltip>
      ),
    });
  }

  return (
    <DataTable columns={columns} data={items} loading={loading} rowKey={(row) => row.task_id} />
  );
}
