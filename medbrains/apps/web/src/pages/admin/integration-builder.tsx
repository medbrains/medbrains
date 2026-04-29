import { ActionIcon, Box, Button, Loader, Select, TextInput, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useHasPermission, useIntegrationBuilderStore } from "@medbrains/stores";
import type { PipelineTriggerType } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconBolt,
  IconDeviceFloppy,
  IconHistory,
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
import s from "./integration-builder.module.scss";

const TRIGGER_TYPE_OPTIONS: { value: PipelineTriggerType; label: string }[] = [
  { value: "internal_event", label: "Internal Event" },
  { value: "schedule", label: "Schedule" },
  { value: "webhook", label: "Webhook" },
  { value: "manual", label: "Manual" },
];

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

  const { isLoading } = useQuery({
    queryKey: ["integration", "pipeline", id],
    queryFn: () => api.getPipeline(id ?? ""),
    enabled: Boolean(id),
  });

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
      void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] });
      notifications.show({ title: "Saved", message: "Pipeline saved", color: "success" });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to save", color: "danger" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerPipeline(serverPipelineId ?? ""),
    onSuccess: () => {
      notifications.show({ title: "Triggered", message: "Execution started", color: "primary" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => {
      const next = pipeline.status === "active" ? "paused" : "active";
      return api.updatePipelineStatus(serverPipelineId ?? "", { status: next });
    },
    onSuccess: (data) => {
      loadPipeline(data);
      void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] });
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
    <div className={s.builder}>
      {/* ── Toolbar ── */}
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <Tooltip label="Back to Hub">
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={() => navigate("/admin/integration-hub")}
              aria-label="Back"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>

          <TextInput
            placeholder="Pipeline name"
            size="xs"
            value={pipeline.name}
            onChange={(e) => updatePipelineMeta({ name: e.currentTarget.value })}
            styles={{
              input: {
                fontWeight: 600,
                fontSize: 14,
                border: `1px solid var(--mb-border)`,
                borderRadius: 6,
              },
            }}
            w={220}
          />

          {!serverPipelineId && (
            <TextInput
              placeholder="Code (unique)"
              size="xs"
              value={pipeline.code}
              onChange={(e) => updatePipelineMeta({ code: e.currentTarget.value })}
              w={140}
              styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12 } }}
            />
          )}

          <div className={s.trigBadge}>
            <IconBolt size={14} />
            <Select
              size="xs"
              data={TRIGGER_TYPE_OPTIONS}
              value={pipeline.trigger_type}
              onChange={(v) =>
                updatePipelineMeta({ trigger_type: (v as PipelineTriggerType) ?? "manual" })
              }
              w={130}
              variant="unstyled"
              styles={{ input: { fontWeight: 500, fontSize: 12, padding: 0, height: 20 } }}
            />
          </div>

          {serverPipelineId && (
            <span className={s.statusBadge}>
              <span className={s.statusDot} />
              {pipeline.status}
            </span>
          )}

          {isDirty && <span className={s.unsavedMark}>● unsaved changes</span>}
        </div>

        <div className={s.toolbarRight}>
          <Tooltip label="Undo">
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={!canUndo()}
              onClick={undo}
              aria-label="Undo"
            >
              <IconArrowBackUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo">
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={!canRedo()}
              onClick={redo}
              aria-label="Redo"
            >
              <IconArrowForwardUp size={16} />
            </ActionIcon>
          </Tooltip>

          {serverPipelineId && (
            <Button size="xs" variant="outline" leftSection={<IconHistory size={14} />}>
              Runs
            </Button>
          )}

          {canExecute && serverPipelineId && pipeline.status === "active" && (
            <Button
              size="xs"
              variant="outline"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={() => triggerMutation.mutate()}
              loading={triggerMutation.isPending}
            >
              Test run
            </Button>
          )}

          {canUpdate && serverPipelineId && (
            <Tooltip label={pipeline.status === "active" ? "Pause" : "Activate"}>
              <ActionIcon
                variant="light"
                size="md"
                color={pipeline.status === "active" ? "warning" : "success"}
                onClick={() => toggleStatusMutation.mutate()}
                loading={toggleStatusMutation.isPending}
                aria-label="Toggle status"
              >
                {pipeline.status === "active" ? (
                  <IconToggleRight size={16} />
                ) : (
                  <IconToggleLeft size={16} />
                )}
              </ActionIcon>
            </Tooltip>
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
        </div>
      </div>

      {/* ── 3-pane layout ── */}
      <div className={s.panes}>
        {/* Left — Palette */}
        <div className={s.palette}>
          <NodePalette />
        </div>

        {/* Center — Canvas */}
        <div className={s.canvas}>
          <PipelineCanvas />
        </div>

        {/* Right — Properties */}
        <div className={s.props}>
          <NodePropertyPanel />
        </div>
      </div>

      {/* ── Trace panel ── */}
      {serverPipelineId && (
        <div className={s.trace}>
          <div className={s.traceHead}>
            <h5 className={s.traceTitle}>Last run</h5>
            <div className={s.traceTabs}>
              <button type="button" className={s.traceTabActive}>
                Trace
              </button>
              <button type="button" className={s.traceTab}>
                Inputs
              </button>
              <button type="button" className={s.traceTab}>
                Outputs
              </button>
              <button type="button" className={s.traceTab}>
                Logs
              </button>
            </div>
            <span className={s.traceMeta}>
              {pipeline.status === "active" ? "Ready" : pipeline.status}
            </span>
          </div>
          <div className={s.traceBody}>
            <div className={s.traceRow}>
              <span className={s.traceTs}>—</span>
              <span className={s.traceStageOk} />
              <span className={s.traceWhat}>
                No executions yet <i>trigger a test run to see trace</i>
              </span>
              <span className={s.traceDelta} />
              <span className={s.traceMs} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
