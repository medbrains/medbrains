import type { CombineMode, FieldMapping, MappingSource, TransformStep } from "@medbrains/types";
import type { Edge, Node } from "@xyflow/react";

// ── Node data types for freeform canvas ────────────────────

export interface SourceFieldNodeData {
  fieldPath: string;
  fieldType?: string;
  nodeLabel?: string;
  [key: string]: unknown;
}

export interface OperationNodeData {
  operation: string;
  config: Record<string, unknown>;
  label: string;
  category: string;
  [key: string]: unknown;
}

export interface CombinerNodeData {
  combineMode: CombineMode;
  separator?: string;
  templateStr?: string;
  expression?: string;
  sourceCount: number;
  [key: string]: unknown;
}

export interface DestFieldNodeData {
  fieldPath: string;
  fieldType?: string;
  required?: boolean;
  [key: string]: unknown;
}

export type MapperNode =
  | Node<SourceFieldNodeData, "sourceField">
  | Node<OperationNodeData, "operation">
  | Node<CombinerNodeData, "combiner">
  | Node<DestFieldNodeData, "destField">;

// ── Layout constants ──────────────────────────────────────

const COL_WIDTH = 250;
const ROW_HEIGHT = 100;
const SOURCE_X = 50;
const DEST_PADDING = 50;

// ── ID generators ─────────────────────────────────────────

let _syncSeq = 0;
function syncId(prefix: string): string {
  _syncSeq += 1;
  return `${prefix}_${_syncSeq}`;
}

// ── mappingsToFreeform: FieldMapping[] → { nodes, edges } ──

export function mappingsToFreeform(mappings: FieldMapping[]): {
  nodes: MapperNode[];
  edges: Edge[];
} {
  const nodes: MapperNode[] = [];
  const edges: Edge[] = [];

  // Track source node dedup (same source path → same node)
  const sourceNodeMap = new Map<string, string>();
  let sourceRow = 0;

  for (let mIdx = 0; mIdx < mappings.length; mIdx++) {
    const m = mappings[mIdx];
    if (!m) continue;
    const rowY = mIdx * ROW_HEIGHT * 1.5;

    const isGrouped =
      m.combineMode && m.combineMode !== "single" && m.sources && m.sources.length > 1;

    const sourcePaths = isGrouped ? (m.sources ?? []).map((s) => s.path) : m.from ? [m.from] : [];

    // Create source nodes
    const sourceNodeIds: string[] = [];
    for (const sp of sourcePaths) {
      if (sourceNodeMap.has(sp)) {
        sourceNodeIds.push(sourceNodeMap.get(sp) as string);
      } else {
        const nodeId = syncId("src");
        sourceNodeMap.set(sp, nodeId);
        nodes.push({
          id: nodeId,
          type: "sourceField",
          position: { x: SOURCE_X, y: sourceRow * ROW_HEIGHT },
          data: { fieldPath: sp },
        } as MapperNode);
        sourceNodeIds.push(nodeId);
        sourceRow++;
      }
    }

    // Create combiner node if grouped
    let lastNodeId: string | undefined;
    let currentX = SOURCE_X + COL_WIDTH;

    if (isGrouped && sourceNodeIds.length > 1) {
      const combinerId = syncId("cmb");
      nodes.push({
        id: combinerId,
        type: "combiner",
        position: { x: currentX, y: rowY },
        data: {
          combineMode: m.combineMode ?? "concat",
          separator: m.combineConfig?.separator,
          templateStr: m.combineConfig?.templateStr,
          expression: m.combineConfig?.expression,
          sourceCount: sourceNodeIds.length,
        },
      } as MapperNode);

      // Edges from sources to combiner
      for (let i = 0; i < sourceNodeIds.length; i++) {
        edges.push({
          id: syncId("e"),
          source: sourceNodeIds[i] as string,
          target: combinerId,
          sourceHandle: "output",
          targetHandle: `input-${i}`,
        });
      }

      lastNodeId = combinerId;
      currentX += COL_WIDTH;
    } else if (sourceNodeIds.length === 1) {
      lastNodeId = sourceNodeIds[0];
    }

    // Create operation nodes for the chain
    const chain = resolveChainFromMapping(m);
    for (const step of chain) {
      const opNodeId = syncId("op");
      const desc = step.operation;
      nodes.push({
        id: opNodeId,
        type: "operation",
        position: { x: currentX, y: rowY },
        data: {
          operation: step.operation,
          config: { ...step.config } as Record<string, unknown>,
          label: desc,
          category: "",
          stepId: step.id,
        },
      } as MapperNode);

      if (lastNodeId) {
        edges.push({
          id: syncId("e"),
          source: lastNodeId,
          target: opNodeId,
          sourceHandle: "output",
          targetHandle: "input",
        });
      }

      lastNodeId = opNodeId;
      currentX += COL_WIDTH;
    }

    // Create destination node
    if (m.to) {
      const destId = syncId("dst");
      nodes.push({
        id: destId,
        type: "destField",
        position: { x: currentX + DEST_PADDING, y: rowY },
        data: { fieldPath: m.to },
      } as MapperNode);

      if (lastNodeId) {
        edges.push({
          id: syncId("e"),
          source: lastNodeId,
          target: destId,
          sourceHandle: "output",
          targetHandle: "input",
        });
      }
    }
  }

  return { nodes, edges };
}

// ── freeformToMappings: (nodes, edges) → FieldMapping[] ──

export function freeformToMappings(nodes: MapperNode[], edges: Edge[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  // Find all destination nodes
  const destNodes = nodes.filter((n) => n.type === "destField");

  for (const dest of destNodes) {
    // Walk backward from dest to find the full path
    const path = walkBackward(dest.id, nodes, edges);
    if (!path) continue;

    const mapping = pathToMapping(path, nodes);
    if (mapping) {
      mappings.push(mapping);
    }
  }

  return mappings;
}

// ── Walk backward from a node to find connected chain ─────

interface NodePath {
  destNode: MapperNode;
  operationNodes: MapperNode[];
  combinerNode?: MapperNode;
  sourceNodes: MapperNode[];
}

function walkBackward(destId: string, nodes: MapperNode[], edges: Edge[]): NodePath | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const destNode = nodeMap.get(destId);
  if (!destNode || destNode.type !== "destField") return null;

  const operationNodes: MapperNode[] = [];
  const sourceNodes: MapperNode[] = [];
  let combinerNode: MapperNode | undefined;

  // Walk backward via edges
  let currentId = destId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const incomingEdge = edges.find((e) => e.target === currentId);
    if (!incomingEdge) break;

    const prevNode = nodeMap.get(incomingEdge.source);
    if (!prevNode) break;

    if (prevNode.type === "operation") {
      operationNodes.unshift(prevNode);
      currentId = prevNode.id;
    } else if (prevNode.type === "combiner") {
      combinerNode = prevNode;
      // Find all sources connected to this combiner
      const combinerInputEdges = edges.filter((e) => e.target === prevNode.id);
      for (const ce of combinerInputEdges) {
        const srcNode = nodeMap.get(ce.source);
        if (srcNode && srcNode.type === "sourceField") {
          sourceNodes.push(srcNode);
        }
      }
      break;
    } else if (prevNode.type === "sourceField") {
      sourceNodes.push(prevNode);
      break;
    } else {
      break;
    }
  }

  return { destNode, operationNodes, combinerNode, sourceNodes };
}

// ── Convert a path of nodes into a FieldMapping ───────────

let _mapSeq = 0;

function pathToMapping(path: NodePath, _nodes: MapperNode[]): FieldMapping | null {
  _mapSeq += 1;
  const destData = path.destNode.data as DestFieldNodeData;

  // Build chain from operation nodes
  const chain: TransformStep[] = path.operationNodes.map((opNode) => {
    const data = opNode.data as OperationNodeData;
    return {
      id: (data.stepId as string) ?? syncId("step"),
      operation: data.operation as TransformStep["operation"],
      config: { ...data.config },
    };
  });

  // Determine sources
  const isGrouped = path.combinerNode && path.sourceNodes.length > 1;

  if (isGrouped && path.combinerNode) {
    const combData = path.combinerNode.data as CombinerNodeData;
    const sources: MappingSource[] = path.sourceNodes.map((sn, i) => ({
      id: `ff_src_${_mapSeq}_${i}`,
      path: (sn.data as SourceFieldNodeData).fieldPath,
    }));

    return {
      id: `freeform_${_mapSeq}`,
      from: sources[0]?.path ?? "",
      to: destData.fieldPath,
      operation: chain[0]?.operation ?? ("none" as const),
      operationConfig: chain[0]?.config ?? {},
      chain,
      sources,
      combineMode: combData.combineMode,
      combineConfig: {
        separator: combData.separator,
        templateStr: combData.templateStr,
        expression: combData.expression,
      },
    };
  }

  // Single source
  const sourceData =
    path.sourceNodes.length > 0 ? (path.sourceNodes[0]?.data as SourceFieldNodeData) : null;

  return {
    id: `freeform_${_mapSeq}`,
    from: sourceData?.fieldPath ?? "",
    to: destData.fieldPath,
    operation: chain[0]?.operation ?? ("none" as const),
    operationConfig: chain[0]?.config ?? {},
    chain,
  };
}

// ── Resolve chain from mapping (backward compat) ──────────

function resolveChainFromMapping(mapping: FieldMapping): TransformStep[] {
  if (mapping.chain && mapping.chain.length > 0) return mapping.chain;
  if (mapping.operation && mapping.operation !== "none") {
    return [
      {
        id: `legacy_${mapping.id}`,
        operation: mapping.operation,
        config: mapping.operationConfig ?? {},
      },
    ];
  }
  return [];
}
