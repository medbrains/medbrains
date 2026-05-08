import { Badge, Text } from "@mantine/core";
import type { MappingOperationType } from "@medbrains/types";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { OperationNodeData } from "../mapperSync";
import { getConfigSummary, getDescriptor } from "../operationRegistry";

const CATEGORY_COLORS: Record<string, string> = {
  string: "primary",
  array: "teal",
  number: "orange",
  date: "violet",
  conversion: "danger",
};

export function OperationNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as OperationNodeData;
  const desc = getDescriptor(nodeData.operation as MappingOperationType);
  const color = CATEGORY_COLORS[desc?.category ?? nodeData.category] ?? "slate";
  const summary = getConfigSummary(nodeData.operation as MappingOperationType, nodeData.config);

  return (
    <div
      style={{
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${color}-4)`,
        background: "var(--mantine-color-white)",
        minWidth: 120,
        overflow: "hidden",
        boxShadow: selected
          ? `0 0 0 2px var(--mantine-color-${color}-2)`
          : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          background: `var(--mantine-color-${color}-0)`,
          borderBottom: `1px solid var(--mantine-color-${color}-2)`,
        }}
      >
        <Badge size="xs" variant="light" color={color}>
          {desc?.category ?? "op"}
        </Badge>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <Text size="sm" fw={600}>
          {desc?.label ?? nodeData.label}
        </Text>
        {summary && (
          <Text size="xs" c="dimmed" truncate>
            {summary}
          </Text>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          width: 10,
          height: 10,
          background: `var(--mantine-color-${color}-5)`,
          border: "2px solid var(--mantine-color-white)",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: 10,
          height: 10,
          background: `var(--mantine-color-${color}-5)`,
          border: "2px solid var(--mantine-color-white)",
        }}
      />
    </div>
  );
}
