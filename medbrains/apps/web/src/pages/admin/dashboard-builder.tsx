import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Kbd,
  Loader,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import type { WidgetTemplate } from "@medbrains/types";
import { useDashboardBuilderStore } from "@medbrains/stores";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { PageHeader } from "../../components";
import { WidgetPalette } from "../../components/Dashboard/WidgetPalette";
import { BuilderCanvas } from "../../components/Dashboard/BuilderCanvas";
import { WidgetPropertyPanel } from "../../components/Dashboard/WidgetPropertyPanel";
import { useNavigate, useParams } from "react-router";
import { useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { SectionIcon } from "../../components/DynamicForm/SectionIcon";
import { useState } from "react";

export function DashboardBuilderPage() {
  useRequirePermission(P.ADMIN.DASHBOARD_BUILDER.LIST);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const store = useDashboardBuilderStore();
  const {
    dashboard,
    widgets,
    isPreviewMode,
    isFullscreen,
    isDirty,
    serverDashboardId,
    selectedWidgetId,
    loadDashboard,
    updateDashboardMeta,
    addWidget,
    setPreviewMode,
    setFullscreen,
    removeWidget,
    duplicateWidget,
    copyWidget,
    pasteWidget,
    nudgeWidget,
    autoArrange,
    undo,
    redo,
    canUndo,
    canRedo,
    markClean,
  } = store;

  // Drag overlay state
  const [activeDragTemplate, setActiveDragTemplate] =
    useState<WidgetTemplate | null>(null);

  // Load existing dashboard
  const { data: existingDashboard, isLoading } = useQuery({
    queryKey: ["dashboard-detail", id],
    queryFn: () => api.getDashboard(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (existingDashboard) {
      loadDashboard(existingDashboard);
    }
  }, [existingDashboard, loadDashboard]);

  // Load templates — uses user-facing endpoint which applies widget access resolution.
  // Admins still see all templates (bypass roles skip all filters).
  const { data: templates = [] } = useQuery({
    queryKey: ["widget-templates"],
    queryFn: () => api.listWidgetTemplates(),
  });

  // ── Keyboard shortcuts ─────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Undo
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Redo
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      // Delete selected widget
      if ((e.key === "Delete" || e.key === "Backspace") && selectedWidgetId) {
        const el = e.target as HTMLElement;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
        e.preventDefault();
        removeWidget(selectedWidgetId);
        return;
      }
      // Duplicate
      if (meta && e.key === "d" && selectedWidgetId) {
        e.preventDefault();
        duplicateWidget(selectedWidgetId);
        return;
      }
      // Copy
      if (meta && e.key === "c" && selectedWidgetId) {
        copyWidget(selectedWidgetId);
        return;
      }
      // Paste
      if (meta && e.key === "v") {
        pasteWidget();
        return;
      }
      // Save
      if (meta && e.key === "s") {
        e.preventDefault();
        if (isDirty) saveMutation.mutate();
        return;
      }
      // Arrow keys to nudge
      if (selectedWidgetId && !meta) {
        const el = e.target as HTMLElement;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeWidget(selectedWidgetId, "left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeWidget(selectedWidgetId, "right");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeWidget(selectedWidgetId, "up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeWidget(selectedWidgetId, "down");
        }
      }
      // Escape to exit fullscreen or deselect
      if (e.key === "Escape") {
        if (isFullscreen) {
          setFullscreen(false);
        } else if (selectedWidgetId) {
          store.selectWidget(null);
        }
      }
    },
    [
      undo,
      redo,
      selectedWidgetId,
      removeWidget,
      duplicateWidget,
      copyWidget,
      pasteWidget,
      nudgeWidget,
      isDirty,
      isFullscreen,
      setFullscreen,
      store,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Save mutation ──────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (serverDashboardId) {
        await api.adminUpdateDashboard(serverDashboardId, {
          name: dashboard.name,
          description: dashboard.description || undefined,
          role_codes: dashboard.role_codes,
          department_ids: dashboard.department_ids,
          layout_config: dashboard.layout_config,
          is_default: dashboard.is_default,
        });

        const existingWidgets = Object.values(widgets).filter((w) => w.id);
        if (existingWidgets.length > 0) {
          await api.adminUpdateLayout(serverDashboardId, {
            widgets: existingWidgets.map((w) => ({
              id: w.id,
              position_x: w.position_x,
              position_y: w.position_y,
              width: w.width,
              height: w.height,
            })),
          });
        }

        const newWidgets = Object.values(widgets).filter((w) => w.isNew);
        for (const w of newWidgets) {
          await api.adminAddWidget(serverDashboardId, {
            widget_type: w.widget_type,
            title: w.title,
            subtitle: w.subtitle ?? undefined,
            icon: w.icon ?? undefined,
            color: w.color ?? undefined,
            config: w.config,
            data_source: w.data_source,
            data_filters: w.data_filters,
            position_x: w.position_x,
            position_y: w.position_y,
            width: w.width,
            height: w.height,
            refresh_interval: w.refresh_interval ?? undefined,
            permission_code: w.permission_code ?? undefined,
          });
        }
      } else {
        const created = await api.adminCreateDashboard({
          name: dashboard.name,
          code: dashboard.code,
          description: dashboard.description || undefined,
          role_codes: dashboard.role_codes,
          department_ids: dashboard.department_ids,
          layout_config: dashboard.layout_config,
          is_default: dashboard.is_default,
        });

        for (const w of Object.values(widgets)) {
          await api.adminAddWidget(created.id, {
            widget_type: w.widget_type,
            title: w.title,
            subtitle: w.subtitle ?? undefined,
            icon: w.icon ?? undefined,
            color: w.color ?? undefined,
            config: w.config,
            data_source: w.data_source,
            data_filters: w.data_filters,
            position_x: w.position_x,
            position_y: w.position_y,
            width: w.width,
            height: w.height,
            refresh_interval: w.refresh_interval ?? undefined,
            permission_code: w.permission_code ?? undefined,
          });
        }

        navigate(`/admin/dashboard-builder/${created.id}`, { replace: true });
      }
    },
    onSuccess: () => {
      markClean();
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      notifications.show({
        title: "Saved",
        message: "Dashboard saved successfully",
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to save dashboard",
        color: "danger",
      });
    },
  });

  // ── DnD handlers ───────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "template") {
      setActiveDragTemplate(data.template as WidgetTemplate);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragTemplate(null);
    const { active, over } = event;
    if (!over || over.id !== "canvas") return;

    const data = active.data.current;
    if (data?.type === "template") {
      const template = data.template as WidgetTemplate;
      addWidget(template, { x: 0, y: 0 });
    }
  }

  // ── Loading state ──────────────────────────────────────

  if (isLoading && id) {
    return (
      <div>
        <PageHeader title="Dashboard Builder" subtitle="Loading..." />
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </div>
    );
  }

  const widgetCount = Object.keys(widgets).length;

  // ── Fullscreen mode ────────────────────────────────────

  if (isFullscreen) {
    return (
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--mantine-color-body)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Fullscreen toolbar */}
          <Group
            justify="space-between"
            px="md"
            py="xs"
            style={{
              borderBottom: "1px solid var(--mantine-color-gray-2)",
              background: "var(--mantine-color-white)",
            }}
          >
            <Group gap="sm">
              <Text size="sm" fw={700}>
                {dashboard.name || "Dashboard Builder"}
              </Text>
              {isPreviewMode && (
                <Badge size="xs" color="teal" variant="light">
                  Preview
                </Badge>
              )}
              <Badge size="xs" variant="light" color="slate">
                {widgetCount} widgets
              </Badge>
            </Group>
            <Group gap="xs">
              <ToolbarActions
                isPreviewMode={isPreviewMode}
                canUndo={canUndo()}
                canRedo={canRedo()}
                isDirty={isDirty}
                isSaving={saveMutation.isPending}
                onUndo={undo}
                onRedo={redo}
                onTogglePreview={() => setPreviewMode(!isPreviewMode)}
                onSave={() => saveMutation.mutate()}
                onAutoArrange={autoArrange}
              />
              <Divider orientation="vertical" />
              <Tooltip label="Exit fullscreen (Esc)">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setFullscreen(false)}
                  aria-label="Arrows Minimize"
                >
                  <IconArrowsMinimize size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Fullscreen content */}
          <Box
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: isPreviewMode ? "1fr" : "250px 1fr 290px",
              overflow: "hidden",
            }}
          >
            {!isPreviewMode && (
              <Box
                style={{
                  borderRight: "1px solid var(--mantine-color-gray-2)",
                  padding: 12,
                  overflow: "auto",
                }}
              >
                <WidgetPalette templates={templates} />
              </Box>
            )}

            <Box style={{ overflow: "auto", padding: 12 }}>
              <BuilderCanvas isPreviewMode={isPreviewMode} />
            </Box>

            {!isPreviewMode && (
              <Box
                style={{
                  borderLeft: "1px solid var(--mantine-color-gray-2)",
                  padding: 12,
                  overflow: "auto",
                }}
              >
                <WidgetPropertyPanel />
              </Box>
            )}
          </Box>
        </Box>

        <DragOverlay dropAnimation={null}>
          {activeDragTemplate && (
            <DragOverlayCard template={activeDragTemplate} />
          )}
        </DragOverlay>
      </DndContext>
    );
  }

  // ── Normal mode ────────────────────────────────────────

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div>
        <PageHeader
          title="Dashboard Builder"
          subtitle={dashboard.name || "New Dashboard"}
          actions={
            <Group gap="sm">
              <ToolbarActions
                isPreviewMode={isPreviewMode}
                canUndo={canUndo()}
                canRedo={canRedo()}
                isDirty={isDirty}
                isSaving={saveMutation.isPending}
                onUndo={undo}
                onRedo={redo}
                onTogglePreview={() => setPreviewMode(!isPreviewMode)}
                onSave={() => saveMutation.mutate()}
                onAutoArrange={autoArrange}
              />
              <Divider orientation="vertical" />
              <Tooltip label="Fullscreen">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setFullscreen(true)}
                  aria-label="Arrows Maximize"
                >
                  <IconArrowsMaximize size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          }
        />

        {/* Dashboard metadata + gating rules */}
        {!isPreviewMode && (
          <Card padding="sm" mb="md">
            <Stack gap="sm">
              {/* Row 1: Basic info */}
              <Group gap="sm" align="flex-end" wrap="wrap">
                <TextInput
                  label="Name"
                  size="xs"
                  style={{ flex: 1, minWidth: 150 }}
                  value={dashboard.name}
                  onChange={(e) =>
                    updateDashboardMeta({ name: e.currentTarget.value })
                  }
                />
                <TextInput
                  label="Code"
                  size="xs"
                  style={{ width: 140 }}
                  value={dashboard.code}
                  onChange={(e) =>
                    updateDashboardMeta({ code: e.currentTarget.value })
                  }
                />
                <Textarea
                  label="Description"
                  size="xs"
                  style={{ flex: 1, minWidth: 150 }}
                  autosize
                  minRows={1}
                  maxRows={2}
                  value={dashboard.description}
                  onChange={(e) =>
                    updateDashboardMeta({ description: e.currentTarget.value })
                  }
                />
              </Group>

              {/* Row 2: Options */}
              <Group gap="sm" align="flex-end" wrap="wrap">
                <Switch
                  label="Default Dashboard"
                  description="Fallback for unmatched users"
                  size="xs"
                  checked={dashboard.is_default}
                  onChange={(e) =>
                    updateDashboardMeta({
                      is_default: e.currentTarget.checked,
                    })
                  }
                />
                <Badge size="xs" variant="light" color="slate">
                  {widgetCount} widgets
                </Badge>
                {dashboard.user_id && (
                  <Badge size="xs" variant="light" color="violet">Personal</Badge>
                )}
                {dashboard.cloned_from && (
                  <Badge size="xs" variant="outline" color="slate">Cloned</Badge>
                )}
              </Group>
            </Stack>
          </Card>
        )}

        {/* Keyboard shortcut hints */}
        {!isPreviewMode && (
          <Group gap="xs" mb="xs" opacity={0.5}>
            <Text fz={10} c="dimmed">
              Shortcuts:
            </Text>
            <Group gap={4}>
              <Kbd>⌘Z</Kbd>
              <Text fz={10} c="dimmed">Undo</Text>
            </Group>
            <Group gap={4}>
              <Kbd>⌘D</Kbd>
              <Text fz={10} c="dimmed">Duplicate</Text>
            </Group>
            <Group gap={4}>
              <Kbd>Del</Kbd>
              <Text fz={10} c="dimmed">Delete</Text>
            </Group>
            <Group gap={4}>
              <Kbd>↑↓←→</Kbd>
              <Text fz={10} c="dimmed">Move</Text>
            </Group>
            <Group gap={4}>
              <Kbd>⌘S</Kbd>
              <Text fz={10} c="dimmed">Save</Text>
            </Group>
          </Group>
        )}

        {/* Three-panel layout */}
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isPreviewMode ? "1fr" : "250px 1fr 290px",
            gap: 16,
            minHeight: "calc(100vh - 280px)",
          }}
        >
          {!isPreviewMode && (
            <Box
              style={{
                borderRight: "1px solid var(--mantine-color-gray-2)",
                paddingRight: 12,
              }}
            >
              <WidgetPalette templates={templates} />
            </Box>
          )}

          <Box style={{ overflow: "auto" }}>
            <BuilderCanvas isPreviewMode={isPreviewMode} />
          </Box>

          {!isPreviewMode && (
            <Box
              style={{
                borderLeft: "1px solid var(--mantine-color-gray-2)",
                paddingLeft: 12,
              }}
            >
              <WidgetPropertyPanel />
            </Box>
          )}
        </Box>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragTemplate && (
          <DragOverlayCard template={activeDragTemplate} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Shared Toolbar Actions ───────────────────────────────

function ToolbarActions({
  isPreviewMode,
  canUndo,
  canRedo,
  isDirty,
  isSaving,
  onUndo,
  onRedo,
  onTogglePreview,
  onSave,
  onAutoArrange,
}: {
  isPreviewMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePreview: () => void;
  onSave: () => void;
  onAutoArrange: () => void;
}) {
  return (
    <>
      <Tooltip label="Undo (⌘Z)">
        <ActionIcon
          variant="subtle"
          size="sm"
          disabled={!canUndo}
          onClick={onUndo}
          aria-label="Arrow Back Up"
        >
          <IconArrowBackUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Redo (⌘⇧Z)">
        <ActionIcon
          variant="subtle"
          size="sm"
          disabled={!canRedo}
          onClick={onRedo}
          aria-label="Arrow Forward Up"
        >
          <IconArrowForwardUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Auto-arrange widgets">
        <ActionIcon variant="subtle" size="sm" onClick={onAutoArrange} aria-label="Grid view">
          <IconLayoutGrid size={16} />
        </ActionIcon>
      </Tooltip>
      <Divider orientation="vertical" />
      <Button
        variant={isPreviewMode ? "filled" : "subtle"}
        color={isPreviewMode ? "teal" : undefined}
        size="xs"
        leftSection={
          isPreviewMode ? <IconEyeOff size={14} /> : <IconEye size={14} />
        }
        onClick={onTogglePreview}
      >
        {isPreviewMode ? "Exit Preview" : "Preview"}
      </Button>
      <Button
        size="xs"
        leftSection={<IconDeviceFloppy size={14} />}
        loading={isSaving}
        disabled={!isDirty}
        onClick={onSave}
      >
        Save
      </Button>
    </>
  );
}

// ── Drag Overlay Card ────────────────────────────────────

function DragOverlayCard({ template }: { template: WidgetTemplate }) {
  return (
    <Card
      padding="xs"
      shadow="lg"
      style={{
        width: 180,
        opacity: 0.85,
        border: "2px solid var(--mantine-color-primary-4)",
        transform: "rotate(-2deg)",
      }}
    >
      <Group gap="xs" wrap="nowrap">
        {template.icon && (
          <SectionIcon icon={template.icon} size={16} />
        )}
        <div>
          <Text size="xs" fw={600} truncate>
            {template.name}
          </Text>
          <Text fz={10} c="dimmed">
            {template.default_width}x{template.default_height}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
