import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef } from "react";
import type { MapperNode } from "./mapperSync";
import { CombinerNode } from "./nodes/CombinerNode";
import { DestFieldNode } from "./nodes/DestFieldNode";
import { OperationNode } from "./nodes/OperationNode";
import { SourceFieldNode } from "./nodes/SourceFieldNode";

// ── Custom node types ─────────────────────────────────────

const nodeTypes = {
  sourceField: SourceFieldNode,
  operation: OperationNode,
  combiner: CombinerNode,
  destField: DestFieldNode,
};

// ── Props ─────────────────────────────────────────────────

interface FreeformMapperCanvasProps {
  nodes: MapperNode[];
  edges: Edge[];
  onNodesChange: (nodes: MapperNode[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onSelectionChange?: (selectedNodeIds: string[]) => void;
  onDrop?: (
    type: string,
    data: Record<string, unknown>,
    position: { x: number; y: number },
  ) => void;
}

// ── Component ─────────────────────────────────────────────

export function FreeformMapperCanvas({
  nodes,
  edges,
  onNodesChange: setNodes,
  onEdgesChange: setEdges,
  onSelectionChange,
  onDrop,
}: FreeformMapperCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodes) as MapperNode[];
      setNodes(updated);
    },
    [nodes, setNodes],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated);
    },
    [edges, setEdges],
  );

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const updated = addEdge(
        {
          ...connection,
          id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          animated: true,
          style: { stroke: "var(--mantine-color-blue-4)", strokeWidth: 2 },
        },
        edges,
      );
      setEdges(updated);
    },
    [edges, setEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      onSelectionChange?.(selectedNodes.map((n) => n.id));
    },
    [onSelectionChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!onDrop || !reactFlowWrapper.current) return;

      const rawData = e.dataTransfer.getData("application/mapper-node");
      if (!rawData) return;

      try {
        const parsed = JSON.parse(rawData) as { type: string; data: Record<string, unknown> };
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = {
          x: e.clientX - bounds.left,
          y: e.clientY - bounds.top,
        };
        onDrop(parsed.type, parsed.data, position);
      } catch {
        // Invalid drag data
      }
    },
    [onDrop],
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { stroke: "var(--mantine-color-blue-4)", strokeWidth: 2 },
    }),
    [],
  );

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: "100%", height: "100%" }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        selectNodesOnDrag={false}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            switch (n.type) {
              case "sourceField":
                return "var(--mantine-color-green-4)";
              case "operation":
                return "var(--mantine-color-blue-4)";
              case "combiner":
                return "var(--mantine-color-violet-4)";
              case "destField":
                return "var(--mantine-color-orange-4)";
              default:
                return "var(--mantine-color-gray-4)";
            }
          }}
          style={{ height: 80 }}
        />
      </ReactFlow>
    </div>
  );
}
