import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useIntegrationBuilderStore } from "@medbrains/stores";
import type { IntegrationNodeTemplate, ReactFlowEdge, ReactFlowNode } from "@medbrains/types";
import { type DragEvent, useCallback, useMemo } from "react";
import { ActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";
import { TransformNode } from "./TransformNode";
import { TriggerNode } from "./TriggerNode";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  transform: TransformNode,
  delay: TransformNode,
};

const defaultEdgeOptions = {
  animated: true,
  style: { strokeWidth: 2, stroke: "var(--mantine-color-gray-5)" },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: "var(--mantine-color-gray-5)",
  },
};

function PipelineCanvasInner() {
  const nodes = useIntegrationBuilderStore((s) => s.nodes);
  const edges = useIntegrationBuilderStore((s) => s.edges);
  const setNodes = useIntegrationBuilderStore((s) => s.setNodes);
  const setEdges = useIntegrationBuilderStore((s) => s.setEdges);
  const selectNode = useIntegrationBuilderStore((s) => s.selectNode);
  const addNode = useIntegrationBuilderStore((s) => s.addNode);

  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodes as Node[]);
      setNodes(updated as ReactFlowNode[]);
    },
    [nodes, setNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const updated = applyEdgeChanges(changes, edges as Edge[]);
      setEdges(updated as ReactFlowEdge[]);
    },
    [edges, setEdges],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const updated = addEdge(connection, edges);
      setEdges(updated);
    },
    [edges, setEdges],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData("application/integration-node");
      if (!raw) return;

      const template = JSON.parse(raw) as IntegrationNodeTemplate;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(template, position);
    },
    [screenToFlowPosition, addNode],
  );

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      nodeTypes={memoizedNodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      deleteKeyCode="Delete"
      connectionLineStyle={{ strokeWidth: 2, stroke: "var(--mantine-color-blue-4)" }}
      style={{ width: "100%", height: "100%" }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color="var(--mantine-color-gray-3)"
      />
      <Controls
        showInteractive={false}
        style={{ borderRadius: 0, border: "1px solid var(--mantine-color-gray-3)" }}
      />
      <MiniMap
        pannable
        zoomable
        style={{
          width: 140,
          height: 90,
          borderRadius: 0,
          border: "1px solid var(--mantine-color-gray-3)",
        }}
        maskColor="rgba(0, 0, 0, 0.08)"
      />
    </ReactFlow>
  );
}

export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner />
    </ReactFlowProvider>
  );
}
