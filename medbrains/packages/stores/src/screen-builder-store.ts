import type {
  ScreenAction,
  ScreenLayout,
  ScreenStatus,
  ScreenType,
  ScreenZone,
  ScreenZoneType,
  SidecarTrigger,
} from "@medbrains/types";
import { deepClone } from "@medbrains/utils";
import { create } from "zustand";

// ── ID Generation ────────────────────────────────────────

let counter = 0;
function generateId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

// ── History ──────────────────────────────────────────────

const MAX_HISTORY = 50;

interface HistoryEntry {
  zones: Record<string, ZoneNode>;
  zoneOrder: string[];
  actions: Record<string, ActionNode>;
  actionOrder: string[];
  sidecars: Record<string, SidecarNode>;
  sidecarOrder: string[];
  header: ScreenHeader;
  breadcrumbs: BreadcrumbItem[];
}

function takeSnapshot(state: ScreenBuilderStoreState): HistoryEntry {
  return {
    zones: deepClone(state.zones),
    zoneOrder: [...state.zoneOrder],
    actions: deepClone(state.actions),
    actionOrder: [...state.actionOrder],
    sidecars: deepClone(state.sidecars),
    sidecarOrder: [...state.sidecarOrder],
    header: deepClone(state.header),
    breadcrumbs: deepClone(state.breadcrumbs),
  };
}

// ── Node Types ──────────────────────────────────────────

export interface ZoneNode {
  clientId: string;
  serverId: string | null;
  type: ScreenZoneType;
  key: string;
  label: string;
  config: Record<string, unknown>;
}

export interface ActionNode {
  clientId: string;
  key: string;
  label: string;
  icon: string;
  variant: string;
  action_type: string;
  permission: string;
  route: string;
  confirm: boolean;
}

export interface SidecarNode {
  clientId: string;
  serverId: string | null;
  name: string;
  description: string;
  trigger_event: SidecarTrigger;
  trigger_config: Record<string, unknown>;
  pipeline_id: string | null;
  inline_action: Record<string, unknown> | null;
  condition: Record<string, unknown> | null;
  is_active: boolean;
}

export interface ScreenHeader {
  title: string;
  subtitle: string;
  icon: string;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface ScreenMeta {
  id: string;
  code: string;
  name: string;
  screen_type: ScreenType;
  module_code: string;
  route_path: string;
  icon: string;
  permission_code: string;
  status: ScreenStatus;
  version: number;
  description: string;
}

export type SelectedItemType = "header" | "zone" | "action" | "sidecar" | null;

// ── Store Actions ────────────────────────────────────────

interface ScreenBuilderActions {
  // Zone operations
  addZone: (type: ScreenZoneType, index?: number) => void;
  updateZone: (clientId: string, updates: Partial<ZoneNode>) => void;
  removeZone: (clientId: string) => void;
  reorderZones: (fromIndex: number, toIndex: number) => void;
  duplicateZone: (clientId: string) => void;

  // Action operations
  addAction: (actionType: string, label: string) => void;
  updateAction: (clientId: string, updates: Partial<ActionNode>) => void;
  removeAction: (clientId: string) => void;
  reorderActions: (fromIndex: number, toIndex: number) => void;

  // Sidecar operations
  addSidecar: (trigger: SidecarTrigger, name: string) => void;
  updateSidecar: (clientId: string, updates: Partial<SidecarNode>) => void;
  removeSidecar: (clientId: string) => void;
  reorderSidecars: (fromIndex: number, toIndex: number) => void;

  // Selection
  selectItem: (id: string | null, type: SelectedItemType) => void;

  // Header & breadcrumbs
  updateHeader: (updates: Partial<ScreenHeader>) => void;
  updateBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;

  // Screen metadata
  updateScreenMeta: (updates: Partial<ScreenMeta>) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Persistence
  loadScreen: (data: LoadScreenData) => void;
  resetScreen: () => void;
  markClean: () => void;
  assembleLayout: () => ScreenLayout;

  // Preview
  setPreviewMode: (enabled: boolean) => void;
}

export interface LoadScreenData {
  screen: ScreenMeta;
  header: ScreenHeader;
  breadcrumbs: BreadcrumbItem[];
  zones: Record<string, ZoneNode>;
  zoneOrder: string[];
  actions: Record<string, ActionNode>;
  actionOrder: string[];
  sidecars: Record<string, SidecarNode>;
  sidecarOrder: string[];
}

// ── Store State ─────────────────────────────────────────

export interface ScreenBuilderStoreState extends ScreenBuilderActions {
  screen: ScreenMeta;
  header: ScreenHeader;
  breadcrumbs: BreadcrumbItem[];
  zones: Record<string, ZoneNode>;
  zoneOrder: string[];
  actions: Record<string, ActionNode>;
  actionOrder: string[];
  sidecars: Record<string, SidecarNode>;
  sidecarOrder: string[];
  selectedItemId: string | null;
  selectedItemType: SelectedItemType;
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
  isDirty: boolean;
  serverScreenId: string | null;
  isPreviewMode: boolean;
}

// ── Default Zone Labels ──────────────────────────────────

const ZONE_TYPE_LABELS: Record<ScreenZoneType, string> = {
  form: "Form",
  data_table: "Data Table",
  filter_bar: "Filter Bar",
  detail_header: "Detail Header",
  tabs: "Tabs",
  stepper: "Stepper",
  calendar: "Calendar",
  kanban: "Kanban Board",
  widget_grid: "Widget Grid",
  info_panel: "Info Panel",
};

function defaultZoneKey(type: ScreenZoneType, index: number): string {
  return `${type}_${index + 1}`;
}

// ── Initial State ───────────────────────────────────────

const INITIAL_SCREEN: ScreenMeta = {
  id: "",
  code: "",
  name: "Untitled Screen",
  screen_type: "list",
  module_code: "",
  route_path: "",
  icon: "",
  permission_code: "",
  status: "draft",
  version: 1,
  description: "",
};

const INITIAL_HEADER: ScreenHeader = { title: "", subtitle: "", icon: "" };

// ── Store ──────────────────────────────────────────────

export const useScreenBuilderStore = create<ScreenBuilderStoreState>()((set, get) => ({
  screen: { ...INITIAL_SCREEN },
  header: { ...INITIAL_HEADER },
  breadcrumbs: [],
  zones: {},
  zoneOrder: [],
  actions: {},
  actionOrder: [],
  sidecars: {},
  sidecarOrder: [],
  selectedItemId: null,
  selectedItemType: null,
  history: { past: [], future: [] },
  isDirty: false,
  serverScreenId: null,
  isPreviewMode: false,

  // ── Zone Operations ─────────────────────────────────

  addZone: (type, index) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const clientId = generateId("zone");
    const existingCount = state.zoneOrder.filter(
      (id) => state.zones[id]?.type === type,
    ).length;

    const zone: ZoneNode = {
      clientId,
      serverId: null,
      type,
      key: defaultZoneKey(type, existingCount),
      label: ZONE_TYPE_LABELS[type],
      config: {},
    };

    const newOrder = [...state.zoneOrder];
    const insertAt = index ?? newOrder.length;
    newOrder.splice(insertAt, 0, clientId);

    set({
      zones: { ...state.zones, [clientId]: zone },
      zoneOrder: newOrder,
      selectedItemId: clientId,
      selectedItemType: "zone",
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateZone: (clientId, updates) => {
    const state = get();
    const existing = state.zones[clientId];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    set({
      zones: {
        ...state.zones,
        [clientId]: { ...existing, ...updates, clientId },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeZone: (clientId) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const { [clientId]: _removed, ...remainingZones } = state.zones;

    set({
      zones: remainingZones,
      zoneOrder: state.zoneOrder.filter((id) => id !== clientId),
      selectedItemId: state.selectedItemId === clientId ? null : state.selectedItemId,
      selectedItemType: state.selectedItemId === clientId ? null : state.selectedItemType,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  reorderZones: (fromIndex, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const newOrder = [...state.zoneOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    if (moved) {
      newOrder.splice(toIndex, 0, moved);
    }

    set({
      zoneOrder: newOrder,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  duplicateZone: (clientId) => {
    const state = get();
    const existing = state.zones[clientId];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    const newClientId = generateId("zone");
    const clone: ZoneNode = {
      ...deepClone(existing),
      clientId: newClientId,
      serverId: null,
      key: `${existing.key}_copy`,
      label: `${existing.label} (copy)`,
    };

    const index = state.zoneOrder.indexOf(clientId);
    const newOrder = [...state.zoneOrder];
    newOrder.splice(index + 1, 0, newClientId);

    set({
      zones: { ...state.zones, [newClientId]: clone },
      zoneOrder: newOrder,
      selectedItemId: newClientId,
      selectedItemType: "zone",
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Action Operations ──────────────────────────────

  addAction: (actionType, label) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const clientId = generateId("act");

    const action: ActionNode = {
      clientId,
      key: label.toLowerCase().replace(/\s+/g, "_"),
      label,
      icon: "",
      variant: actionType === "delete" ? "light" : "filled",
      action_type: actionType,
      permission: "",
      route: "",
      confirm: actionType === "delete",
    };

    set({
      actions: { ...state.actions, [clientId]: action },
      actionOrder: [...state.actionOrder, clientId],
      selectedItemId: clientId,
      selectedItemType: "action",
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateAction: (clientId, updates) => {
    const state = get();
    const existing = state.actions[clientId];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    set({
      actions: {
        ...state.actions,
        [clientId]: { ...existing, ...updates, clientId },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeAction: (clientId) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const { [clientId]: _removed, ...remainingActions } = state.actions;

    set({
      actions: remainingActions,
      actionOrder: state.actionOrder.filter((id) => id !== clientId),
      selectedItemId: state.selectedItemId === clientId ? null : state.selectedItemId,
      selectedItemType: state.selectedItemId === clientId ? null : state.selectedItemType,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  reorderActions: (fromIndex, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const newOrder = [...state.actionOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    if (moved) {
      newOrder.splice(toIndex, 0, moved);
    }

    set({
      actionOrder: newOrder,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Sidecar Operations ─────────────────────────────

  addSidecar: (trigger, name) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const clientId = generateId("sc");

    const sidecar: SidecarNode = {
      clientId,
      serverId: null,
      name,
      description: "",
      trigger_event: trigger,
      trigger_config: {},
      pipeline_id: null,
      inline_action: null,
      condition: null,
      is_active: true,
    };

    set({
      sidecars: { ...state.sidecars, [clientId]: sidecar },
      sidecarOrder: [...state.sidecarOrder, clientId],
      selectedItemId: clientId,
      selectedItemType: "sidecar",
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateSidecar: (clientId, updates) => {
    const state = get();
    const existing = state.sidecars[clientId];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    set({
      sidecars: {
        ...state.sidecars,
        [clientId]: { ...existing, ...updates, clientId },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeSidecar: (clientId) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const { [clientId]: _removed, ...remainingSidecars } = state.sidecars;

    set({
      sidecars: remainingSidecars,
      sidecarOrder: state.sidecarOrder.filter((id) => id !== clientId),
      selectedItemId: state.selectedItemId === clientId ? null : state.selectedItemId,
      selectedItemType: state.selectedItemId === clientId ? null : state.selectedItemType,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  reorderSidecars: (fromIndex, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const newOrder = [...state.sidecarOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    if (moved) {
      newOrder.splice(toIndex, 0, moved);
    }

    set({
      sidecarOrder: newOrder,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Selection ─────────────────────────────────────

  selectItem: (id, type) => set({ selectedItemId: id, selectedItemType: type }),

  // ── Header & Breadcrumbs ──────────────────────────

  updateHeader: (updates) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    set({
      header: { ...state.header, ...updates },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateBreadcrumbs: (breadcrumbs) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    set({
      breadcrumbs,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Screen Metadata ───────────────────────────────

  updateScreenMeta: (updates) => {
    const state = get();
    set({ screen: { ...state.screen, ...updates }, isDirty: true });
  },

  // ── History ───────────────────────────────────────

  undo: () => {
    const state = get();
    const { past, future } = state.history;
    if (past.length === 0) return;

    const currentSnapshot = takeSnapshot(state);
    const previous = past[past.length - 1]!;

    set({
      zones: previous.zones,
      zoneOrder: previous.zoneOrder,
      actions: previous.actions,
      actionOrder: previous.actionOrder,
      sidecars: previous.sidecars,
      sidecarOrder: previous.sidecarOrder,
      header: previous.header,
      breadcrumbs: previous.breadcrumbs,
      isDirty: true,
      history: {
        past: past.slice(0, -1),
        future: [currentSnapshot, ...future].slice(0, MAX_HISTORY),
      },
    });
  },

  redo: () => {
    const state = get();
    const { past, future } = state.history;
    if (future.length === 0) return;

    const currentSnapshot = takeSnapshot(state);
    const next = future[0]!;

    set({
      zones: next.zones,
      zoneOrder: next.zoneOrder,
      actions: next.actions,
      actionOrder: next.actionOrder,
      sidecars: next.sidecars,
      sidecarOrder: next.sidecarOrder,
      header: next.header,
      breadcrumbs: next.breadcrumbs,
      isDirty: true,
      history: {
        past: [...past, currentSnapshot],
        future: future.slice(1),
      },
    });
  },

  // ── Persistence ───────────────────────────────────

  loadScreen: (data) => {
    set({
      screen: data.screen,
      header: data.header,
      breadcrumbs: data.breadcrumbs,
      zones: data.zones,
      zoneOrder: data.zoneOrder,
      actions: data.actions,
      actionOrder: data.actionOrder,
      sidecars: data.sidecars,
      sidecarOrder: data.sidecarOrder,
      selectedItemId: null,
      selectedItemType: null,
      history: { past: [], future: [] },
      isDirty: false,
      serverScreenId: data.screen.id || null,
      isPreviewMode: false,
    });
  },

  resetScreen: () => {
    set({
      screen: { ...INITIAL_SCREEN },
      header: { ...INITIAL_HEADER },
      breadcrumbs: [],
      zones: {},
      zoneOrder: [],
      actions: {},
      actionOrder: [],
      sidecars: {},
      sidecarOrder: [],
      selectedItemId: null,
      selectedItemType: null,
      history: { past: [], future: [] },
      isDirty: false,
      serverScreenId: null,
      isPreviewMode: false,
    });
  },

  markClean: () => set({ isDirty: false }),

  assembleLayout: () => {
    const state = get();
    const zones: ScreenZone[] = state.zoneOrder.map((id) => {
      const z = state.zones[id]!;
      return { type: z.type, key: z.key, label: z.label, config: z.config };
    });

    const actions: ScreenAction[] = state.actionOrder.map((id) => {
      const a = state.actions[id]!;
      return {
        key: a.key,
        label: a.label,
        icon: a.icon || undefined,
        variant: a.variant || undefined,
        action_type: a.action_type,
        permission: a.permission || undefined,
        route: a.route || undefined,
      };
    });

    const layout: ScreenLayout = {
      zones,
      actions: actions.length > 0 ? actions : undefined,
    };

    if (state.header.title) {
      layout.header = {
        title: state.header.title,
        subtitle: state.header.subtitle || undefined,
        icon: state.header.icon || undefined,
      };
    }

    if (state.breadcrumbs.length > 0) {
      layout.breadcrumbs = state.breadcrumbs;
    }

    return layout;
  },

  // ── Preview ────────────────────────────────────────

  setPreviewMode: (enabled) => set({ isPreviewMode: enabled }),
}));
