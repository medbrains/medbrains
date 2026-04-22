import { create } from "zustand";
import type {
  DashboardWidget,
  DashboardWithWidgets,
  LayoutConfig,
  WidgetDataFilters,
  WidgetDataSource,
  WidgetTemplate,
  WidgetType,
} from "@medbrains/types";
import { deepClone } from "@medbrains/utils";

// ── Constants ────────────────────────────────────────────

const MAX_COLUMNS = 12;
const MAX_HISTORY = 50;

// ── Types ────────────────────────────────────────────────

export interface WidgetNode {
  id: string;
  clientId: string;
  widget_type: WidgetType;
  title: string;
  subtitle: string | null;
  icon: string | null;
  color: string | null;
  config: Record<string, unknown>;
  data_source: WidgetDataSource;
  data_filters: WidgetDataFilters;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  permission_code: string | null;
  sort_order: number;
  isNew?: boolean;
}

export interface DashboardMeta {
  id: string;
  name: string;
  code: string;
  description: string;
  role_codes: string[];
  department_ids: string[];
  is_default: boolean;
  layout_config: LayoutConfig;
  user_id: string | null;
  cloned_from: string | null;
}

interface HistoryEntry {
  widgets: Record<string, WidgetNode>;
}

export interface DragPreview {
  clientId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DashboardBuilderState {
  dashboard: DashboardMeta;
  widgets: Record<string, WidgetNode>;
  selectedWidgetId: string | null;
  isPreviewMode: boolean;
  isFullscreen: boolean;
  isDirty: boolean;
  serverDashboardId: string | null;
  clipboard: WidgetNode | null;
  dragPreview: DragPreview | null;
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
}

interface DashboardBuilderActions {
  loadDashboard: (data: DashboardWithWidgets) => void;
  updateDashboardMeta: (updates: Partial<DashboardMeta>) => void;
  addWidget: (
    template: WidgetTemplate,
    position: { x: number; y: number },
  ) => string;
  addCustomWidget: (widget: Partial<WidgetNode>) => string;
  updateWidget: (id: string, changes: Partial<WidgetNode>) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: { x: number; y: number }) => void;
  resizeWidget: (id: string, size: { w: number; h: number }) => void;
  selectWidget: (id: string | null) => void;
  setPreviewMode: (preview: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setDragPreview: (preview: DragPreview | null) => void;
  duplicateWidget: (id: string) => string | null;
  copyWidget: (id: string) => void;
  pasteWidget: () => string | null;
  autoArrange: () => void;
  nudgeWidget: (
    id: string,
    direction: "left" | "right" | "up" | "down",
  ) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  markClean: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getWidgetList: () => WidgetNode[];
  getLayoutPayload: () => {
    id: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
  }[];
}

type DashboardBuilderStore = DashboardBuilderState & DashboardBuilderActions;

// ── Helpers ──────────────────────────────────────────────

let counter = 0;
function generateClientId(): string {
  counter += 1;
  return `wgt_${Date.now()}_${counter}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function takeSnapshot(state: DashboardBuilderState): HistoryEntry {
  return { widgets: deepClone(state.widgets) };
}

function widgetFromServer(w: DashboardWidget): WidgetNode {
  return {
    id: w.id,
    clientId: w.id,
    widget_type: w.widget_type,
    title: w.title,
    subtitle: w.subtitle,
    icon: w.icon,
    color: w.color,
    config: w.config,
    data_source: w.data_source,
    data_filters: w.data_filters ?? {},
    position_x: w.position_x,
    position_y: w.position_y,
    width: w.width,
    height: w.height,
    min_width: w.min_width,
    min_height: w.min_height,
    refresh_interval: w.refresh_interval,
    is_visible: w.is_visible,
    permission_code: w.permission_code,
    sort_order: w.sort_order,
  };
}

/** Check if a rectangle overlaps with any existing widget. */
function hasCollision(
  widgets: Record<string, WidgetNode>,
  x: number,
  y: number,
  w: number,
  h: number,
  excludeId?: string,
): boolean {
  for (const widget of Object.values(widgets)) {
    if (widget.clientId === excludeId) continue;
    const wx = widget.position_x;
    const wy = widget.position_y;
    const wr = wx + widget.width;
    const wb = wy + widget.height;
    if (x < wr && x + w > wx && y < wb && y + h > wy) return true;
  }
  return false;
}

/** Find the next available position that can fit a widget of given size. */
function findNextAvailablePosition(
  widgets: Record<string, WidgetNode>,
  w: number,
  h: number,
): { x: number; y: number } {
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col <= MAX_COLUMNS - w; col++) {
      if (!hasCollision(widgets, col, row, w, h)) {
        return { x: col, y: row };
      }
    }
  }
  return { x: 0, y: 0 };
}

// ── Initial State ────────────────────────────────────────

const INITIAL_STATE: DashboardBuilderState = {
  dashboard: {
    id: "",
    name: "Untitled Dashboard",
    code: "",
    description: "",
    role_codes: [],
    department_ids: [],
    is_default: false,
    layout_config: { columns: 12, row_height: 80, gap: 16 },
    user_id: null,
    cloned_from: null,
  },
  widgets: {},
  selectedWidgetId: null,
  isPreviewMode: false,
  isFullscreen: false,
  isDirty: false,
  serverDashboardId: null,
  clipboard: null,
  dragPreview: null,
  history: { past: [], future: [] },
};

// ── Store ────────────────────────────────────────────────

export const useDashboardBuilderStore = create<DashboardBuilderStore>()(
  (set, get) => ({
    ...INITIAL_STATE,

    loadDashboard: (data) => {
      const widgetMap: Record<string, WidgetNode> = {};
      for (const w of data.widgets) {
        const node = widgetFromServer(w);
        widgetMap[node.clientId] = node;
      }
      set({
        dashboard: {
          id: data.dashboard.id,
          name: data.dashboard.name,
          code: data.dashboard.code,
          description: data.dashboard.description ?? "",
          role_codes: Array.isArray(data.dashboard.role_codes)
            ? data.dashboard.role_codes
            : [],
          department_ids: Array.isArray(data.dashboard.department_ids)
            ? data.dashboard.department_ids
            : [],
          is_default: data.dashboard.is_default,
          layout_config: (data.dashboard.layout_config as LayoutConfig) ?? {
            columns: 12,
            row_height: 80,
            gap: 16,
          },
          user_id: data.dashboard.user_id ?? null,
          cloned_from: data.dashboard.cloned_from ?? null,
        },
        widgets: widgetMap,
        selectedWidgetId: null,
        isPreviewMode: false,
        isFullscreen: false,
        isDirty: false,
        serverDashboardId: data.dashboard.id,
        clipboard: null,
        dragPreview: null,
        history: { past: [], future: [] },
      });
    },

    updateDashboardMeta: (updates) => {
      const state = get();
      set({
        dashboard: { ...state.dashboard, ...updates },
        isDirty: true,
      });
    },

    addWidget: (template, position) => {
      const state = get();
      const snapshot = takeSnapshot(state);
      const clientId = generateClientId();

      // Find non-colliding position, starting from the requested position
      const w = template.default_width;
      const h = template.default_height;
      let px = clamp(position.x, 0, MAX_COLUMNS - w);
      let py = Math.max(0, position.y);

      if (hasCollision(state.widgets, px, py, w, h)) {
        const pos = findNextAvailablePosition(state.widgets, w, h);
        px = pos.x;
        py = pos.y;
      }

      const node: WidgetNode = {
        id: "",
        clientId,
        widget_type: template.widget_type,
        title: template.name,
        subtitle: template.description,
        icon: template.icon,
        color: template.color,
        config: { ...template.default_config },
        data_source: template.default_source as unknown as WidgetDataSource,
        data_filters: {},
        position_x: px,
        position_y: py,
        width: w,
        height: h,
        min_width: 2,
        min_height: 1,
        refresh_interval: null,
        is_visible: true,
        permission_code: null,
        sort_order: Object.keys(state.widgets).length,
        isNew: true,
      };

      set({
        widgets: { ...state.widgets, [clientId]: node },
        selectedWidgetId: clientId,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });

      return clientId;
    },

    addCustomWidget: (partial) => {
      const state = get();
      const snapshot = takeSnapshot(state);
      const clientId = generateClientId();

      const w = partial.width ?? 4;
      const h = partial.height ?? 2;
      const px = partial.position_x ?? 0;
      const py = partial.position_y ?? 0;

      const node: WidgetNode = {
        id: "",
        clientId,
        widget_type: partial.widget_type ?? "stat_card",
        title: partial.title ?? "New Widget",
        subtitle: partial.subtitle ?? null,
        icon: partial.icon ?? null,
        color: partial.color ?? null,
        config: partial.config ?? {},
        data_source: partial.data_source ?? { type: "static" },
        data_filters: partial.data_filters ?? {},
        position_x: px,
        position_y: py,
        width: w,
        height: h,
        min_width: partial.min_width ?? 2,
        min_height: partial.min_height ?? 1,
        refresh_interval: partial.refresh_interval ?? null,
        is_visible: true,
        permission_code: null,
        sort_order: Object.keys(state.widgets).length,
        isNew: true,
      };

      set({
        widgets: { ...state.widgets, [clientId]: node },
        selectedWidgetId: clientId,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });

      return clientId;
    },

    updateWidget: (id, changes) => {
      const state = get();
      const existing = state.widgets[id];
      if (!existing) return;

      const snapshot = takeSnapshot(state);
      set({
        widgets: {
          ...state.widgets,
          [id]: { ...existing, ...changes, clientId: id },
        },
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    removeWidget: (id) => {
      const state = get();
      const snapshot = takeSnapshot(state);
      const { [id]: _removed, ...rest } = state.widgets;

      set({
        widgets: rest,
        selectedWidgetId:
          state.selectedWidgetId === id ? null : state.selectedWidgetId,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    moveWidget: (id, position) => {
      const state = get();
      const widget = state.widgets[id];
      if (!widget) return;

      const newX = clamp(position.x, 0, MAX_COLUMNS - widget.width);
      const newY = Math.max(0, position.y);

      if (newX === widget.position_x && newY === widget.position_y) return;

      const snapshot = takeSnapshot(state);
      set({
        widgets: {
          ...state.widgets,
          [id]: {
            ...widget,
            position_x: newX,
            position_y: newY,
          },
        },
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    resizeWidget: (id, size) => {
      const state = get();
      const widget = state.widgets[id];
      if (!widget) return;

      const w = clamp(size.w, widget.min_width, MAX_COLUMNS);
      const h = clamp(size.h, widget.min_height, 8);

      if (w === widget.width && h === widget.height) return;

      const snapshot = takeSnapshot(state);
      set({
        widgets: {
          ...state.widgets,
          [id]: {
            ...widget,
            width: w,
            height: h,
            position_x: clamp(
              widget.position_x,
              0,
              MAX_COLUMNS - w,
            ),
          },
        },
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    selectWidget: (id) => set({ selectedWidgetId: id }),

    setPreviewMode: (preview) => set({ isPreviewMode: preview }),

    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

    setDragPreview: (preview) => set({ dragPreview: preview }),

    duplicateWidget: (id) => {
      const state = get();
      const widget = state.widgets[id];
      if (!widget) return null;

      const snapshot = takeSnapshot(state);
      const clientId = generateClientId();
      const pos = findNextAvailablePosition(
        state.widgets,
        widget.width,
        widget.height,
      );

      const clone: WidgetNode = {
        ...deepClone(widget),
        id: "",
        clientId,
        title: `${widget.title} (copy)`,
        position_x: pos.x,
        position_y: pos.y,
        sort_order: Object.keys(state.widgets).length,
        isNew: true,
      };

      set({
        widgets: { ...state.widgets, [clientId]: clone },
        selectedWidgetId: clientId,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });

      return clientId;
    },

    copyWidget: (id) => {
      const state = get();
      const widget = state.widgets[id];
      if (!widget) return;
      set({ clipboard: deepClone(widget) });
    },

    pasteWidget: () => {
      const state = get();
      if (!state.clipboard) return null;

      const snapshot = takeSnapshot(state);
      const clientId = generateClientId();
      const pos = findNextAvailablePosition(
        state.widgets,
        state.clipboard.width,
        state.clipboard.height,
      );

      const node: WidgetNode = {
        ...deepClone(state.clipboard),
        id: "",
        clientId,
        title: `${state.clipboard.title} (copy)`,
        position_x: pos.x,
        position_y: pos.y,
        sort_order: Object.keys(state.widgets).length,
        isNew: true,
      };

      set({
        widgets: { ...state.widgets, [clientId]: node },
        selectedWidgetId: clientId,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });

      return clientId;
    },

    autoArrange: () => {
      const state = get();
      const snapshot = takeSnapshot(state);
      const sorted = Object.values(state.widgets).sort(
        (a, b) => a.sort_order - b.sort_order,
      );

      const arranged: Record<string, WidgetNode> = {};
      const placed: Record<string, WidgetNode> = {};

      for (const widget of sorted) {
        const pos = findNextAvailablePosition(
          placed,
          widget.width,
          widget.height,
        );
        const updated = {
          ...widget,
          position_x: pos.x,
          position_y: pos.y,
        };
        arranged[widget.clientId] = updated;
        placed[widget.clientId] = updated;
      }

      set({
        widgets: arranged,
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    nudgeWidget: (id, direction) => {
      const state = get();
      const widget = state.widgets[id];
      if (!widget) return;

      let dx = 0;
      let dy = 0;
      if (direction === "left") dx = -1;
      if (direction === "right") dx = 1;
      if (direction === "up") dy = -1;
      if (direction === "down") dy = 1;

      const newX = clamp(
        widget.position_x + dx,
        0,
        MAX_COLUMNS - widget.width,
      );
      const newY = Math.max(0, widget.position_y + dy);

      if (newX === widget.position_x && newY === widget.position_y) return;

      const snapshot = takeSnapshot(state);
      set({
        widgets: {
          ...state.widgets,
          [id]: { ...widget, position_x: newX, position_y: newY },
        },
        isDirty: true,
        history: {
          past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    undo: () => {
      const state = get();
      const { past, future } = state.history;
      if (past.length === 0) return;

      const currentSnapshot = takeSnapshot(state);
      const previous = past[past.length - 1]!;

      set({
        widgets: previous.widgets,
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
        widgets: next.widgets,
        isDirty: true,
        history: {
          past: [...past, currentSnapshot],
          future: future.slice(1),
        },
      });
    },

    reset: () => set({ ...INITIAL_STATE }),

    markClean: () => set({ isDirty: false }),

    canUndo: () => get().history.past.length > 0,

    canRedo: () => get().history.future.length > 0,

    getWidgetList: () => {
      const state = get();
      return Object.values(state.widgets).sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    },

    getLayoutPayload: () => {
      const state = get();
      return Object.values(state.widgets)
        .filter((w) => w.id)
        .map((w) => ({
          id: w.id,
          position_x: w.position_x,
          position_y: w.position_y,
          width: w.width,
          height: w.height,
        }));
    },
  }),
);

export type { DashboardBuilderStore };
