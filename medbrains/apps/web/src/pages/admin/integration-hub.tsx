import { ActionIcon, Badge, Button, Group, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { PipelineStatus, PipelineSummary } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconHistory,
  IconLayoutDashboard,
  IconPencil,
  IconPlayerPlay,
  IconPlug,
  IconToggleLeft,
  IconToggleRight,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "../../components/DataTable";
import { ExecutionPanel } from "../../components/Integration";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

const STATUS_COLORS: Record<PipelineStatus, string> = {
  draft: "slate",
  active: "success",
  paused: "warning",
  archived: "dimmed",
};

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

export function IntegrationHubPage() {
  useRequirePermission(P.INTEGRATION.LIST);

  const canCreate = useHasPermission(P.INTEGRATION.CREATE);
  const canUpdate = useHasPermission(P.INTEGRATION.UPDATE);
  const canDelete = useHasPermission(P.INTEGRATION.DELETE);
  const canExecute = useHasPermission(P.INTEGRATION.EXECUTE);
  const canOpenScreenBuilder = useHasPermission(P.ADMIN.SCREEN_BUILDER.LIST);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [execPipelineId, setExecPipelineId] = useState<string | null>(null);
  const [execOpened, { open: openExec, close: closeExec }] = useDisclosure(false);

  const params: Record<string, string> = {
    page: String(page),
    per_page: "20",
  };
  if (statusFilter !== "all") {
    params.status = statusFilter;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["integration", "pipelines", params],
    queryFn: () => api.listPipelines(params),
  });

  const toggleStatus = useMutation({
    mutationFn: (pipeline: PipelineSummary) => {
      const newStatus: PipelineStatus = pipeline.status === "active" ? "paused" : "active";
      return api.updatePipelineStatus(pipeline.id, { status: newStatus });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const deletePipeline = useMutation({
    mutationFn: (id: string) => api.deletePipeline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const triggerPipeline = useMutation({
    mutationFn: (id: string) => api.triggerPipeline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const columns = [
    {
      key: "name",
      label: "Pipeline",
      render: (row: PipelineSummary) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PipelineSummary) => (
        <Badge color={STATUS_COLORS[row.status]} variant="light" size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "trigger",
      label: "Trigger",
      render: (row: PipelineSummary) => (
        <Badge variant="outline" size="sm">
          {row.trigger_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "executions",
      label: "Runs",
      render: (row: PipelineSummary) => <Text size="sm">{row.execution_count}</Text>,
    },
    {
      key: "last_run",
      label: "Last Run",
      render: (row: PipelineSummary) => (
        <Text size="xs" c="dimmed">
          {row.last_run_at ? new Date(row.last_run_at).toLocaleString() : "Never"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: PipelineSummary) => (
        <Group gap={4} wrap="nowrap" justify="flex-end">
          {canExecute && row.status === "active" && (
            <Tooltip label="Trigger">
              <ActionIcon
                variant="subtle"
                size="sm"
                color="primary"
                onClick={() => triggerPipeline.mutate(row.id)}
              >
                <IconPlayerPlay size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Executions">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setExecPipelineId(row.id);
                openExec();
              }}
            >
              <IconHistory size={14} />
            </ActionIcon>
          </Tooltip>
          {canUpdate && (
            <>
              <Tooltip label="Edit">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => navigate(`/admin/integration-builder/${row.id}`)}
                >
                  <IconPencil size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={row.status === "active" ? "Pause" : "Activate"}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={row.status === "active" ? "warning" : "success"}
                  onClick={() => toggleStatus.mutate(row)}
                >
                  {row.status === "active" ? (
                    <IconToggleRight size={14} />
                  ) : (
                    <IconToggleLeft size={14} />
                  )}
                </ActionIcon>
              </Tooltip>
            </>
          )}
          {canDelete && (
            <Tooltip label="Delete">
              <ActionIcon
                variant="subtle"
                size="sm"
                color="danger"
                onClick={() => deletePipeline.mutate(row.id)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Automation Hub"
        subtitle="Build cross-module pipelines and link them through screen or module sidecars"
        actions={
          canOpenScreenBuilder || canCreate ? (
            <>
              {canOpenScreenBuilder && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconLayoutDashboard size={14} />}
                  onClick={() => navigate("/admin/screen-builder")}
                >
                  Open Screen Builder
                </Button>
              )}
              {canCreate && (
                <Button
                  size="xs"
                  leftSection={<IconPlug size={14} />}
                  onClick={() => navigate("/admin/integration-builder")}
                >
                  New Pipeline
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <DataTable<PipelineSummary>
        columns={columns}
        data={data?.pipelines ?? []}
        loading={isLoading}
        total={data?.total}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        perPage={20}
        onPageChange={setPage}
        rowKey={(r) => r.id}
        emptyIcon={<IconPlug size={48} stroke={1} />}
        emptyTitle="No pipelines yet"
        emptyDescription="Create a pipeline here, then attach it to screen or module sidecars to link workflows across modules."
        emptyAction={
          canCreate
            ? {
                label: "New Pipeline",
                onClick: () => navigate("/admin/integration-builder"),
              }
            : undefined
        }
        toolbar={
          <SegmentedControl
            size="xs"
            data={FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      <ExecutionPanel pipelineId={execPipelineId} opened={execOpened} onClose={closeExec} />
    </div>
  );
}
