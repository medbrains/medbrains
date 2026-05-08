import { Badge, Text } from "@mantine/core";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { SourceFieldNodeData } from "../mapperSync";

export function SourceFieldNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as SourceFieldNodeData;

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: `2px solid ${selected ? "var(--mantine-color-blue-5)" : "var(--mantine-color-green-4)"}`,
        background: "var(--mantine-color-white)",
        minWidth: 140,
        boxShadow: selected ? "0 0 0 2px var(--mantine-color-blue-2)" : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <Text size="xs" c="dimmed" fw={600} mb={2}>
        Source
      </Text>
      <Text size="sm" fw={500} truncate>
        {nodeData.fieldPath}
      </Text>
      {nodeData.fieldType && (
        <Badge size="xs" variant="light" color="slate" mt={4}>
          {nodeData.fieldType}
        </Badge>
      )}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: 10,
          height: 10,
          background: "var(--mantine-color-green-5)",
          border: "2px solid var(--mantine-color-white)",
        }}
      />
    </div>
  );
}
