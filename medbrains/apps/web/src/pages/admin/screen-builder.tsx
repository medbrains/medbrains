import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Badge,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type {
  CreateScreenRequest,
  ScreenAction,
  ScreenLayout,
  ScreenMaster,
  ScreenSidecar,
  ScreenSummary,
  ScreenType,
  ScreenVersionSummary,
  ScreenZone,
  ScreenZoneType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  useHasPermission,
  useScreenBuilderStore,
  type ActionNode,
  type LoadScreenData,
  type SidecarNode,
  type ZoneNode,
} from "@medbrains/stores";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { PageHeader } from "../../components";
import {
  ScreenCanvas,
  ScreenPropertyPanel,
  ZonePalette,
} from "../../components/ScreenBuilder";
import { ScreenRenderer } from "../../components/ScreenRenderer";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconGitBranch,
  IconHistory,
  IconLayout,
  IconLock,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import classes from "../../components/ScreenBuilder/screen-builder.module.scss";

// ── Constants ─────────────────────────────────────────────

const SCREEN_TYPE_OPTIONS: Array<{ value: ScreenType; label: string }> = [
  { value: "form", label: "Form" },
  { value: "list", label: "List" },
  { value: "detail", label: "Detail" },
  { value: "composite", label: "Composite" },
  { value: "wizard", label: "Wizard" },
  { value: "dashboard", label: "Dashboard" },
  { value: "calendar", label: "Calendar" },
  { value: "kanban", label: "Kanban" },
];

// ── Transformer: API → Store ─────────────────────────────

function transformScreenToStore(
  screen: ScreenMaster,
  sidecars: ScreenSidecar[],
): LoadScreenData {
  const layout = (screen.layout ?? {}) as Partial<ScreenLayout>;

  // Parse zones
  const zones: Record<string, ZoneNode> = {};
  const zoneOrder: string[] = [];
  const rawZones = (layout.zones ?? []) as ScreenZone[];
  for (const [i, z] of rawZones.entries()) {
    const clientId = `zone_server_${i}`;
    zones[clientId] = {
      clientId,
      serverId: null,
      type: z.type,
      key: z.key,
      label: z.label ?? z.type,
      config: z.config ?? {},
    };
    zoneOrder.push(clientId);
  }

  // Parse actions
  const actions: Record<string, ActionNode> = {};
  const actionOrder: string[] = [];
  const rawActions = (layout.actions ?? []) as ScreenAction[];
  for (const [i, a] of rawActions.entries()) {
    const clientId = `act_server_${i}`;
    actions[clientId] = {
      clientId,
      key: a.key,
      label: a.label,
      icon: a.icon ?? "",
      variant: a.variant ?? "filled",
      action_type: a.action_type,
      permission: a.permission ?? "",
      route: a.route ?? "",
      confirm: a.confirm ?? false,
    };
    actionOrder.push(clientId);
  }

  // Parse sidecars
  const sidecarMap: Record<string, SidecarNode> = {};
  const sidecarOrder: string[] = [];
  for (const s of sidecars) {
    const clientId = `sc_server_${s.id}`;
    sidecarMap[clientId] = {
      clientId,
      serverId: s.id,
      name: s.name,
      description: s.description ?? "",
      trigger_event: s.trigger_event,
      trigger_config: s.trigger_config ?? {},
      pipeline_id: s.pipeline_id,
      inline_action: s.inline_action,
      condition: s.condition,
      is_active: s.is_active,
    };
    sidecarOrder.push(clientId);
  }

  return {
    screen: {
      id: screen.id,
      code: screen.code,
      name: screen.name,
      screen_type: screen.screen_type,
      module_code: screen.module_code ?? "",
      route_path: screen.route_path ?? "",
      icon: screen.icon ?? "",
      permission_code: screen.permission_code ?? "",
      status: screen.status,
      version: screen.version,
      description: screen.description ?? "",
    },
    header: {
      title: (layout.header?.title as string) ?? "",
      subtitle: (layout.header?.subtitle as string) ?? "",
      icon: (layout.header?.icon as string) ?? "",
    },
    breadcrumbs: (layout.breadcrumbs ?? []) as Array<{ label: string; path: string }>,
    zones,
    zoneOrder,
    actions,
    actionOrder,
    sidecars: sidecarMap,
    sidecarOrder,
  };
}

// ── Screen List Panel ────────────────────────────────────

function ScreenListPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const canCreate = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: screens, isLoading } = useQuery({
    queryKey: ["admin-screens"],
    queryFn: () => api.adminListScreens(),
  });

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={4}>Screens</Title>
        {canCreate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Screen
          </Button>
        )}
      </Group>

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Module</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {screens?.map((s: ScreenSummary) => (
            <Table.Tr key={s.id} style={{ cursor: "pointer" }} onClick={() => onSelect(s.id)}>
              <Table.Td>
                <Text size="sm" fw={500}>{s.code}</Text>
              </Table.Td>
              <Table.Td>{s.name}</Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light">{s.screen_type}</Badge>
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  color={s.status === "active" ? "success" : s.status === "draft" ? "warning" : "slate"}
                >
                  {s.status}
                </Badge>
              </Table.Td>
              <Table.Td>{s.module_code ?? "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <CreateScreenModal opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

// ── Create Screen Modal ──────────────────────────────────

function CreateScreenModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateScreenRequest>({
    code: "",
    name: "",
    screen_type: "list",
  });

  const mutation = useMutation({
    mutationFn: () => api.adminCreateScreen(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-screens"] });
      notifications.show({
        title: "Screen created",
        message: `Screen "${form.name}" created as draft.`,
        color: "success",
      });
      onClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create screen.", color: "danger" });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Screen" size="md">
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="patient-list"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.currentTarget.value })}
        />
        <TextInput
          label="Name"
          placeholder="Patient List"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
        />
        <Select
          label="Screen Type"
          data={SCREEN_TYPE_OPTIONS}
          value={form.screen_type}
          onChange={(v) => setForm({ ...form, screen_type: (v ?? "list") as ScreenType })}
        />
        <TextInput
          label="Module Code"
          placeholder="patients"
          value={form.module_code ?? ""}
          onChange={(e) => setForm({ ...form, module_code: e.currentTarget.value || undefined })}
        />
        <TextInput
          label="Route Path"
          placeholder="/patients"
          value={form.route_path ?? ""}
          onChange={(e) => setForm({ ...form, route_path: e.currentTarget.value || undefined })}
        />
        <TextInput
          label="Icon"
          placeholder="IconUsers"
          value={form.icon ?? ""}
          onChange={(e) => setForm({ ...form, icon: e.currentTarget.value || undefined })}
        />
        <TextInput
          label="Permission Code"
          placeholder="patients.list"
          value={form.permission_code ?? ""}
          onChange={(e) => setForm({ ...form, permission_code: e.currentTarget.value || undefined })}
        />
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} leftSection={<IconPlus size={14} />}>
          Create
        </Button>
      </Stack>
    </Modal>
  );
}

// ── Version History Drawer ───────────────────────────────

function ScreenVersionHistoryDrawer({
  screenId,
  currentVersion,
  opened,
  onClose,
}: {
  screenId: string;
  currentVersion: number;
  opened: boolean;
  onClose: () => void;
}) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["admin-screen-versions", screenId],
    queryFn: () => api.adminListScreenVersions(screenId),
    enabled: opened,
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Version History" position="right" size="md">
      {isLoading ? (
        <Loader size="sm" />
      ) : !versions?.length ? (
        <Text c="dimmed">No published versions yet.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Summary</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {versions.map((v: ScreenVersionSummary) => (
              <Table.Tr key={v.id}>
                <Table.Td>
                  v{v.version}
                  {v.version === currentVersion && (
                    <Badge size="xs" ml={4} variant="light" color="primary">current</Badge>
                  )}
                </Table.Td>
                <Table.Td>{v.name}</Table.Td>
                <Table.Td><Badge size="sm" variant="light">{v.status}</Badge></Table.Td>
                <Table.Td>{v.change_summary ?? "—"}</Table.Td>
                <Table.Td>{new Date(v.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Drawer>
  );
}

// ── Drag Overlay Content ─────────────────────────────────

function DragOverlayContent({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div className={classes.dragOverlay}>
      <IconLayout size={14} />
      {label}
    </div>
  );
}

// ── Screen Builder Editor ────────────────────────────────

function ScreenBuilderEditor({ screenId, onBack }: { screenId: string; onBack: () => void }) {
  const queryClient = useQueryClient();

  // Store selectors
  const screen = useScreenBuilderStore((s) => s.screen);
  const zoneOrder = useScreenBuilderStore((s) => s.zoneOrder);
  const actionOrder = useScreenBuilderStore((s) => s.actionOrder);
  const sidecarOrder = useScreenBuilderStore((s) => s.sidecarOrder);
  const history = useScreenBuilderStore((s) => s.history);
  const isDirty = useScreenBuilderStore((s) => s.isDirty);
  const serverScreenId = useScreenBuilderStore((s) => s.serverScreenId);
  const undo = useScreenBuilderStore((s) => s.undo);
  const redo = useScreenBuilderStore((s) => s.redo);
  const loadScreen = useScreenBuilderStore((s) => s.loadScreen);
  const resetScreen = useScreenBuilderStore((s) => s.resetScreen);
  const markClean = useScreenBuilderStore((s) => s.markClean);
  const addZone = useScreenBuilderStore((s) => s.addZone);
  const reorderZones = useScreenBuilderStore((s) => s.reorderZones);
  const updateScreenMeta = useScreenBuilderStore((s) => s.updateScreenMeta);
  const assembleLayout = useScreenBuilderStore((s) => s.assembleLayout);
  const removeZone = useScreenBuilderStore((s) => s.removeZone);
  const removeAction = useScreenBuilderStore((s) => s.removeAction);
  const removeSidecar = useScreenBuilderStore((s) => s.removeSidecar);
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const selectedItemType = useScreenBuilderStore((s) => s.selectedItemType);
  const isPreviewMode = useScreenBuilderStore((s) => s.isPreviewMode);
  const setPreviewMode = useScreenBuilderStore((s) => s.setPreviewMode);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const isLocked = screen.status === "active";

  const [paletteLabel, setPaletteLabel] = useState<string | null>(null);
  const [historyOpened, historyHandlers] = useDisclosure(false);
  const [publishModalOpen, publishModalHandlers] = useDisclosure(false);
  const [publishSummary, setPublishSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLoadedRef = useRef<string | null>(null);

  // ── Fetch screen detail ─────────────────────────────

  const { data: screenDetail, isLoading: screenLoading } = useQuery({
    queryKey: ["admin-screen", screenId],
    queryFn: () => api.adminGetScreen(screenId),
    staleTime: 30_000,
  });

  const { data: screenSidecars } = useQuery({
    queryKey: ["admin-screen-sidecars", screenId],
    queryFn: () => api.adminListScreenSidecars(screenId),
    staleTime: 30_000,
  });

  // ── Load screen into store ──────────────────────────

  useEffect(() => {
    if (screenDetail && screenSidecars && hasLoadedRef.current !== screenId) {
      const data = transformScreenToStore(screenDetail, screenSidecars);
      loadScreen(data);
      hasLoadedRef.current = screenId;
    }
  }, [screenId, screenDetail, screenSidecars, loadScreen]);

  // ── Cleanup on unmount ──────────────────────────────

  useEffect(() => {
    return () => {
      resetScreen();
    };
  }, [resetScreen]);

  // ── Save logic ──────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!serverScreenId) return;
    setSaving(true);

    try {
      const state = useScreenBuilderStore.getState();
      const layout = assembleLayout();

      // 1. Update screen metadata + layout
      await api.adminUpdateScreen(serverScreenId, {
        name: state.screen.name,
        description: state.screen.description || undefined,
        module_code: state.screen.module_code || undefined,
        route_path: state.screen.route_path || undefined,
        icon: state.screen.icon || undefined,
        permission_code: state.screen.permission_code || undefined,
        layout: layout as unknown as Record<string, unknown>,
      });

      // 2. Sync sidecars: delete removed, create new, update existing
      const serverSidecarIds = new Set(
        screenSidecars?.map((s: ScreenSidecar) => s.id) ?? [],
      );

      // Identify which store sidecars map to server IDs
      const storeServerIds = new Set<string>();
      for (const sc of Object.values(state.sidecars)) {
        if (sc.serverId) storeServerIds.add(sc.serverId);
      }

      // Delete sidecars removed from store
      for (const serverId of serverSidecarIds) {
        if (!storeServerIds.has(serverId)) {
          await api.adminDeleteScreenSidecar(serverScreenId, serverId);
        }
      }

      // Create or update sidecars
      for (const clientId of state.sidecarOrder) {
        const sc = state.sidecars[clientId];
        if (!sc) continue;

        const sidecarPayload = {
          name: sc.name,
          description: sc.description || undefined,
          trigger_event: sc.trigger_event,
          trigger_config: sc.trigger_config,
          pipeline_id: sc.pipeline_id ?? undefined,
          inline_action: sc.inline_action ?? undefined,
          condition: sc.condition ?? undefined,
          sort_order: state.sidecarOrder.indexOf(clientId),
        };

        if (sc.serverId && serverSidecarIds.has(sc.serverId)) {
          await api.adminUpdateScreenSidecar(serverScreenId, sc.serverId, sidecarPayload);
        } else {
          await api.adminCreateScreenSidecar(serverScreenId, sidecarPayload);
        }
      }

      markClean();
      void queryClient.invalidateQueries({ queryKey: ["admin-screen", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screen-sidecars", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screens"] });
      notifications.show({
        title: "Screen saved",
        message: `${state.screen.name} has been saved`,
        color: "success",
      });
    } catch (err) {
      notifications.show({
        title: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  }, [serverScreenId, screenSidecars, assembleLayout, markClean, queryClient, screenId]);

  // ── Publish & New Version ───────────────────────────

  const publishMutation = useMutation({
    mutationFn: () => api.adminPublishScreen(serverScreenId!),
    onSuccess: () => {
      notifications.show({
        title: "Screen published",
        message: "Screen is now active and locked.",
        color: "success",
      });
      hasLoadedRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["admin-screen", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screen-sidecars", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screens"] });
      publishModalHandlers.close();
      setPublishSummary("");
    },
    onError: (err: Error) => {
      notifications.show({ title: "Publish failed", message: err.message, color: "danger" });
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: () => api.adminNewScreenVersion(serverScreenId!),
    onSuccess: () => {
      notifications.show({
        title: "New version created",
        message: "Screen is now a draft. You can edit it.",
        color: "primary",
      });
      hasLoadedRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["admin-screen", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screen-sidecars", screenId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-screens"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  // ── Dirty state warning ─────────────────────────────

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Keyboard shortcuts ──────────────────────────────

  useHotkeys([
    ["mod+z", undo],
    ["mod+shift+z", redo],
    ["mod+s", () => { handleSave(); }],
    ["Delete", () => {
      if (selectedItemType === "zone" && selectedItemId) removeZone(selectedItemId);
      if (selectedItemType === "action" && selectedItemId) removeAction(selectedItemId);
      if (selectedItemType === "sidecar" && selectedItemId) removeSidecar(selectedItemId);
    }],
  ]);

  // ── DnD ─────────────────────────────────────────────

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: isLocked ? Infinity : 5 },
  });
  const sensors = useSensors(pointerSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "palette-zone") {
      setPaletteLabel(data.label as string);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setPaletteLabel(null);

      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Palette drop → create new zone
      if (activeData?.type === "palette-zone") {
        const zoneType = activeData.zoneType as ScreenZoneType;
        const currentOrder = useScreenBuilderStore.getState().zoneOrder;

        let insertIndex = currentOrder.length;
        if (overData?.type === "zone") {
          const overIndex = currentOrder.indexOf(over.id as string);
          if (overIndex >= 0) insertIndex = overIndex;
        }

        addZone(zoneType, insertIndex);
        return;
      }

      // Zone reorder
      if (activeData?.type === "zone" && overData?.type === "zone") {
        const currentOrder = useScreenBuilderStore.getState().zoneOrder;
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderZones(oldIndex, newIndex);
        }
      }
    },
    [addZone, reorderZones],
  );

  // ── Loading state ───────────────────────────────────

  if (screenLoading || !screenDetail) {
    return (
      <Center h="calc(100vh - 120px)">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading screen...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <div className={classes.builderWrapper}>
      {/* Toolbar */}
      <div className={classes.toolbar}>
        <div className={classes.toolbarTitle}>
          <Button variant="subtle" size="compact-xs" onClick={onBack}>
            ←
          </Button>
          <IconLayout size={20} stroke={1.5} />
          <Title order={5} fw={600}>
            Screen Builder
          </Title>
          <Divider orientation="vertical" />
          <TextInput
            size="xs"
            variant="unstyled"
            placeholder="Screen name..."
            value={screen.name}
            onChange={(e) => updateScreenMeta({ name: e.currentTarget.value })}
            styles={{
              input: {
                fontWeight: 500,
                fontSize: "var(--mantine-font-size-sm)",
                minWidth: 200,
              },
            }}
            disabled={isLocked}
          />
          {isDirty && (
            <Badge size="xs" variant="dot" color="warning">
              Unsaved
            </Badge>
          )}
        </div>

        <Group gap="xs">
          {!isLocked && (
            <>
              <Tooltip label="Undo (Ctrl+Z)">
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<IconArrowBackUp size={14} />}
                  disabled={!canUndo}
                  onClick={undo}
                >
                  Undo
                </Button>
              </Tooltip>
              <Tooltip label="Redo (Ctrl+Shift+Z)">
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<IconArrowForwardUp size={14} />}
                  disabled={!canRedo}
                  onClick={redo}
                >
                  Redo
                </Button>
              </Tooltip>
              <Divider orientation="vertical" />
            </>
          )}
          <Tooltip label={isPreviewMode ? "Exit Preview" : "Preview Screen"}>
            <Button
              variant={isPreviewMode ? "filled" : "default"}
              color={isPreviewMode ? "teal" : undefined}
              size="compact-sm"
              leftSection={isPreviewMode ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              onClick={() => setPreviewMode(!isPreviewMode)}
            >
              {isPreviewMode ? "Exit Preview" : "Preview"}
            </Button>
          </Tooltip>
          <Tooltip label="Version History">
            <Button
              variant="default"
              size="compact-sm"
              leftSection={<IconHistory size={14} />}
              onClick={historyHandlers.open}
            >
              History
            </Button>
          </Tooltip>
          {isLocked ? (
            <Button
              size="compact-sm"
              color="primary"
              leftSection={<IconGitBranch size={14} />}
              onClick={() => newVersionMutation.mutate()}
              loading={newVersionMutation.isPending}
            >
              New Version
            </Button>
          ) : (
            <>
              <Button
                size="compact-sm"
                leftSection={<IconDeviceFloppy size={14} />}
                onClick={handleSave}
                loading={saving}
                disabled={!isDirty}
              >
                Save
              </Button>
              <Button
                size="compact-sm"
                color="success"
                leftSection={<IconUpload size={14} />}
                onClick={publishModalHandlers.open}
                disabled={isDirty}
              >
                Publish
              </Button>
            </>
          )}
        </Group>
      </div>

      {/* Locked banner */}
      {isLocked && (
        <div style={{
          padding: "8px 16px",
          background: "var(--mantine-color-blue-0)",
          borderBottom: "1px solid var(--mantine-color-blue-2)",
        }}>
          <Group gap="xs">
            <IconLock size={14} color="var(--mantine-color-blue-6)" />
            <Text size="xs" c="blue.7">
              This screen is published and locked. Create a new version to make changes.
            </Text>
          </Group>
        </div>
      )}

      {/* Three-panel builder OR Preview */}
      {isPreviewMode ? (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <ScreenRenderer
            screen={{
              id: serverScreenId ?? "",
              code: screen.code ?? "",
              name: screen.name,
              description: screen.description || null,
              screen_type: screen.screen_type,
              module_code: screen.module_code || null,
              version: screen.version,
              layout: assembleLayout() as unknown as Record<string, unknown>,
              config: {},
              route_path: screen.route_path || null,
              icon: screen.icon || null,
              permission_code: screen.permission_code || null,
              sidecars: Object.values(useScreenBuilderStore.getState().sidecars).map((sc) => ({
                id: sc.serverId ?? sc.clientId,
                name: sc.name,
                trigger_event: sc.trigger_event,
                trigger_config: sc.trigger_config,
                pipeline_id: sc.pipeline_id,
                inline_action: sc.inline_action,
                condition: sc.condition,
              })),
            }}
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={classes.builderLayout}>
            <ZonePalette />
            <ScreenCanvas />
            <ScreenPropertyPanel />
          </div>

          <DragOverlay>
            <DragOverlayContent label={paletteLabel} />
          </DragOverlay>
        </DndContext>
      )}

      {/* Status Bar */}
      <div className={classes.statusBar}>
        <div className={classes.statusItem}>
          <Badge size="xs" variant="light" color={screen.status === "draft" ? "warning" : "success"}>
            v{screen.version} {screen.status.toUpperCase()}
          </Badge>
          {isLocked && <IconLock size={12} color="var(--mantine-color-green-6)" style={{ marginLeft: 4 }} />}
        </div>
        <div className={classes.statusItem}>
          <Text size="xs" c="dimmed">Zones: {zoneOrder.length}</Text>
        </div>
        <div className={classes.statusItem}>
          <Text size="xs" c="dimmed">Actions: {actionOrder.length}</Text>
        </div>
        <div className={classes.statusItem}>
          <Text size="xs" c="dimmed">Triggers: {sidecarOrder.length}</Text>
        </div>
        {serverScreenId && (
          <div className={classes.statusItem}>
            <Text size="xs" c="dimmed">ID: {serverScreenId.slice(0, 8)}...</Text>
          </div>
        )}
      </div>

      {/* Publish Modal */}
      <Modal
        opened={publishModalOpen}
        onClose={publishModalHandlers.close}
        title="Publish Screen"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Publishing will make this screen active and locked. A snapshot will be
            saved to version history.
          </Text>
          <Textarea
            label="Change Summary (optional)"
            placeholder="Describe what changed..."
            value={publishSummary}
            onChange={(e) => setPublishSummary(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={publishModalHandlers.close}>Cancel</Button>
            <Button
              color="success"
              leftSection={<IconUpload size={14} />}
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Version History */}
      {serverScreenId && (
        <ScreenVersionHistoryDrawer
          screenId={serverScreenId}
          currentVersion={screen.version}
          opened={historyOpened}
          onClose={historyHandlers.close}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════════

export function ScreenBuilderPage() {
  useRequirePermission(P.ADMIN.SCREEN_BUILDER.LIST);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <ScreenBuilderEditor
        screenId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Screen Builder"
        subtitle="Configure page layouts, zones, and sidecars"
      />
      <ScreenListPanel onSelect={setSelectedId} />
    </div>
  );
}
