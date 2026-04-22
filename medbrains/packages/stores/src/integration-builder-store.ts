import { create } from "zustand";
import type {
  IntegrationPipeline,
  PipelineTriggerType,
  PipelineStatus,
  ReactFlowNode,
  ReactFlowEdge,
  IntegrationNodeTemplate,
} from "@medbrains/types";
import { deepClone } from "@medbrains/utils";

// ── Constants ────────────────────────────────────────────

const MAX_HISTORY = 50;

// ── Types ────────────────────────────────────────────────

export interface PipelineMeta {
  id: string;
  name: string;
  code: string;
  description: string;
  status: PipelineStatus;
  trigger_type: PipelineTriggerType;
  trigger_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
}

interface HistoryEntry {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

interface IntegrationBuilderState {
  pipeline: PipelineMeta;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  serverPipelineId: string | null;
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
}

export interface IntegrationBuilderActions {
  loadPipeline: (data: IntegrationPipeline) => void;
  updatePipelineMeta: (updates: Partial<PipelineMeta>) => void;
  setNodes: (nodes: ReactFlowNode[]) => void;
  setEdges: (edges: ReactFlowEdge[]) => void;
  addNode: (
    template: IntegrationNodeTemplate,
    position: { x: number; y: number },
  ) => string;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  addEdge: (edge: ReactFlowEdge) => void;
  removeEdge: (id: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  markClean: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getNodesPayload: () => ReactFlowNode[];
  getEdgesPayload: () => ReactFlowEdge[];
}

export type IntegrationBuilderStore = IntegrationBuilderState &
  IntegrationBuilderActions;

// ── Helpers ──────────────────────────────────────────────

let counter = 0;
function generateNodeId(): string {
  counter += 1;
  return `node_${Date.now()}_${counter}`;
}

function generateEdgeId(source: string, target: string): string {
  return `edge_${source}_${target}`;
}

function takeSnapshot(state: IntegrationBuilderState): HistoryEntry {
  return {
    nodes: deepClone(state.nodes),
    edges: deepClone(state.edges),
  };
}

const EMPTY_META: PipelineMeta = {
  id: "",
  name: "",
  code: "",
  description: "",
  status: "draft",
  trigger_type: "manual",
  trigger_config: {},
  metadata: {},
  version: 1,
};

// ── Store ────────────────────────────────────────────────

export const useIntegrationBuilderStore = create<IntegrationBuilderStore>(
  (set, get) => ({
    // State
    pipeline: { ...EMPTY_META },
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isDirty: false,
    serverPipelineId: null,
    history: { past: [], future: [] },

    // ── Actions ──────────────────────────────────────────

    loadPipeline(data: IntegrationPipeline) {
      set({
        pipeline: {
          id: data.id,
          name: data.name,
          code: data.code,
          description: data.description ?? "",
          status: data.status,
          trigger_type: data.trigger_type,
          trigger_config: data.trigger_config,
          metadata: data.metadata,
          version: data.version,
        },
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        selectedNodeId: null,
        isDirty: false,
        serverPipelineId: data.id,
        history: { past: [], future: [] },
      });
    },

    updatePipelineMeta(updates: Partial<PipelineMeta>) {
      set((s) => ({
        pipeline: { ...s.pipeline, ...updates },
        isDirty: true,
      }));
    },

    setNodes(nodes: ReactFlowNode[]) {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        nodes,
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    setEdges(edges: ReactFlowEdge[]) {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        edges,
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    addNode(
      template: IntegrationNodeTemplate,
      position: { x: number; y: number },
    ): string {
      const snapshot = takeSnapshot(get());
      const id = generateNodeId();
      const node: ReactFlowNode = {
        id,
        type: template.node_type,
        position,
        data: {
          label: template.name,
          templateCode: template.code,
          icon: template.icon,
          color: template.color,
          config: deepClone(template.default_config),
        },
      };
      set((s) => ({
        nodes: [...s.nodes, node],
        selectedNodeId: id,
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
      return id;
    },

    updateNodeData(id: string, data: Record<string, unknown>) {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    removeNode(id: string) {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    selectNode(id: string | null) {
      set({ selectedNodeId: id });
    },

    addEdge(edge: ReactFlowEdge) {
      const snapshot = takeSnapshot(get());
      const id =
        edge.id || generateEdgeId(edge.source, edge.target);
      set((s) => ({
        edges: [...s.edges, { ...edge, id }],
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    removeEdge(id: string) {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        edges: s.edges.filter((e) => e.id !== id),
        isDirty: true,
        history: {
          past: [...s.history.past, snapshot].slice(-MAX_HISTORY),
          future: [],
        },
      }));
    },

    undo() {
      const { history, nodes, edges } = get();
      const prev = history.past[history.past.length - 1];
      if (!prev) return;
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        isDirty: true,
        selectedNodeId: null,
        history: {
          past: history.past.slice(0, -1),
          future: [{ nodes: deepClone(nodes), edges: deepClone(edges) }, ...history.future],
        },
      });
    },

    redo() {
      const { history, nodes, edges } = get();
      const next = history.future[0];
      if (!next) return;
      set({
        nodes: next.nodes,
        edges: next.edges,
        isDirty: true,
        selectedNodeId: null,
        history: {
          past: [...history.past, { nodes: deepClone(nodes), edges: deepClone(edges) }],
          future: history.future.slice(1),
        },
      });
    },

    reset() {
      set({
        pipeline: { ...EMPTY_META },
        nodes: [],
        edges: [],
        selectedNodeId: null,
        isDirty: false,
        serverPipelineId: null,
        history: { past: [], future: [] },
      });
    },

    markClean() {
      set({ isDirty: false });
    },

    canUndo() {
      return get().history.past.length > 0;
    },

    canRedo() {
      return get().history.future.length > 0;
    },

    getNodesPayload() {
      return get().nodes;
    },

    getEdgesPayload() {
      return get().edges;
    },
  }),
);
