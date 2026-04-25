import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Select,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useHasPermission, useIntegrationBuilderStore } from "@medbrains/stores";
import type { PipelineTriggerType } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";
import { NodePalette } from "../../components/Integration/NodePalette";
import { NodePropertyPanel } from "../../components/Integration/NodePropertyPanel";
import { PipelineCanvas } from "../../components/Integration/PipelineCanvas";
import { useRequirePermission } from "../../hooks/useRequirePermission";

const TRIGGER_TYPE_OPTIONS: { value: PipelineTriggerType; label: string }[] = [
  { value: "internal_event", label: "Internal Event" },
  { value: "schedule", label: "Schedule" },
  { value: "webhook", label: "Webhook" },
  { value: "manual", label: "Manual" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "slate",
  active: "success",
  paused: "warning",
  archived: "dimmed",
};

export function IntegrationBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const requiredPermission = isEditing ? P.INTEGRATION.UPDATE : P.INTEGRATION.CREATE;

  useRequirePermission(requiredPermission);

  const canCreate = useHasPermission(P.INTEGRATION.CREATE);
  const canExecute = useHasPermission(P.INTEGRATION.EXECUTE);
  const canUpdate = useHasPermission(P.INTEGRATION.UPDATE);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    pipeline,
    nodes,
    edges,
    isDirty,
    serverPipelineId,
    loadPipeline,
    updatePipelineMeta,
    reset,
    canUndo,
    canRedo,
    undo,
    redo,
    markClean,
  } = useIntegrationBuilderStore();
  const canSave = serverPipelineId ? canUpdate : canCreate;

  // Load pipeline if editing
  const { isLoading } = useQuery({
    queryKey: ["integration", "pipeline", id],
    queryFn: () => api.getPipeline(id ?? ""),
    enabled: Boolean(id),
  });

  // Load pipeline data on mount when editing
  useEffectOnce(() => {
    if (!id) {
      reset();
      return;
    }
    api.getPipeline(id).then((data) => {
      loadPipeline(data);
    });
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (serverPipelineId) {
        return api.updatePipeline(serverPipelineId, {
          name: pipeline.name,
          description: pipeline.description || undefined,
          trigger_type: pipeline.trigger_type,
          trigger_config: pipeline.trigger_config,
          nodes,
          edges,
          metadata: pipeline.metadata,
        });
      }
      return api.createPipeline({
        name: pipeline.name,
        code: pipeline.code,
        description: pipeline.description || undefined,
        trigger_type: pipeline.trigger_type,
        trigger_config: pipeline.trigger_config,
        nodes,
        edges,
        metadata: pipeline.metadata,
      });
    },
    onSuccess: (data) => {
      loadPipeline(data);
      markClean();
      void queryClient.invalidateQueries({
        queryKey: ["integration", "pipelines"],
      });
      notifications.show({
        title: "Saved",
        message: "Pipeline saved successfully",
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to save pipeline",
        color: "danger",
      });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerPipeline(serverPipelineId ?? ""),
    onSuccess: () => {
      notifications.show({
        title: "Triggered",
        message: "Pipeline execution started",
        color: "primary",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => {
      const newStatus = pipeline.status === "active" ? "paused" : "active";
      return api.updatePipelineStatus(serverPipelineId ?? "", { status: newStatus });
    },
    onSuccess: (data) => {
      loadPipeline(data);
      void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] });
      notifications.show({
        title: "Status Updated",
        message: `Pipeline is now ${data.status}`,
        color: data.status === "active" ? "success" : "warning",
      });
    },
  });

  if (isLoading && id) {
    return (
      <Box ta="center" py="xl">
        <Loader />
      </Box>
    );
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      {/* Toolbar */}
      <Box
        px="md"
        py={8}
        style={{ borderBottom: "1px solid var(--mantine-color-gray-3)", background: "white" }}
      >
        <Group justify="space-between">
          {/* Left side: Back + pipeline info */}
          <Group gap="sm">
            <Tooltip label="Back to Hub">
              <ActionIcon
                variant="subtle"
                size="md"
                onClick={() => navigate("/admin/integration-hub")}
                aria-label="Go back"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>

            <Divider orientation="vertical" />

            <TextInput
              placeholder="Pipeline name"
              size="xs"
              value={pipeline.name}
              onChange={(e) => updatePipelineMeta({ name: e.currentTarget.value })}
              styles={{ input: { fontWeight: 600, fontSize: 14 } }}
              w={200}
            />

            {!serverPipelineId && (
              <TextInput
                placeholder="Code (unique)"
                size="xs"
                value={pipeline.code}
                onChange={(e) => updatePipelineMeta({ code: e.currentTarget.value })}
                w={140}
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            )}

            <Select
              size="xs"
              data={TRIGGER_TYPE_OPTIONS}
              value={pipeline.trigger_type}
              onChange={(v) =>
                updatePipelineMeta({
                  trigger_type: (v as PipelineTriggerType) ?? "manual",
                })
              }
              w={150}
            />

            {serverPipelineId && (
              <Badge color={STATUS_COLORS[pipeline.status] ?? "slate"} variant="light" size="sm">
                {pipeline.status}
              </Badge>
            )}

            {isDirty && (
              <Badge color="orange" variant="dot" size="xs">
                Unsaved
              </Badge>
            )}
          </Group>

          {/* Right side: Actions */}
          <Group gap={6}>
            <Tooltip label="Undo (Ctrl+Z)">
              <ActionIcon variant="subtle" size="md" disabled={!canUndo()} onClick={undo} aria-label="Arrow Back Up">
                <IconArrowBackUp size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Redo (Ctrl+Shift+Z)">
              <ActionIcon variant="subtle" size="md" disabled={!canRedo()} onClick={redo} aria-label="Arrow Forward Up">
                <IconArrowForwardUp size={18} />
              </ActionIcon>
            </Tooltip>

            <Divider orientation="vertical" />

            {canUpdate && serverPipelineId && (
              <Tooltip
                label={pipeline.status === "active" ? "Pause Pipeline" : "Activate Pipeline"}
              >
                <ActionIcon
                  variant="light"
                  size="md"
                  color={pipeline.status === "active" ? "warning" : "success"}
                  onClick={() => toggleStatusMutation.mutate()}
                  loading={toggleStatusMutation.isPending}
                >
                  {pipeline.status === "active" ? (
                    <IconToggleRight size={18} />
                  ) : (
                    <IconToggleLeft size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
            )}

            {canExecute && serverPipelineId && pipeline.status === "active" && (
              <Button
                size="xs"
                variant="light"
                color="primary"
                leftSection={<IconPlayerPlay size={14} />}
                onClick={() => triggerMutation.mutate()}
                loading={triggerMutation.isPending}
              >
                Test Run
              </Button>
            )}

            <Button
              size="xs"
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!canSave || !pipeline.name || (!isDirty && Boolean(serverPipelineId))}
            >
              {serverPipelineId ? "Save" : "Create"}
            </Button>
          </Group>
        </Group>
      </Box>

      {/* 3-panel layout */}
      <Box style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left — Node Palette */}
        <ScrollArea
          style={{
            width: 260,
            borderRight: "1px solid var(--mantine-color-gray-3)",
            background: "var(--mantine-color-gray-0)",
          }}
          p="sm"
        >
          <NodePalette />
        </ScrollArea>

        {/* Center — Canvas */}
        <Box style={{ flex: 1, position: "relative", background: "var(--mantine-color-gray-1)" }}>
          <PipelineCanvas />
        </Box>

        {/* Right — Property Panel */}
        <ScrollArea
          style={{
            width: 300,
            borderLeft: "1px solid var(--mantine-color-gray-3)",
            background: "white",
          }}
        >
          <NodePropertyPanel />
        </ScrollArea>
      </Box>
    </Box>
  );
}
