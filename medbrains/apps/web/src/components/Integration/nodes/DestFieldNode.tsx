import { Badge, Text } from "@mantine/core";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { DestFieldNodeData } from "@/components/Integration/mapperSync";

export function DestFieldNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DestFieldNodeData;

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 0,
        border: `2px solid ${selected ? "var(--mantine-color-blue-5)" : "var(--mantine-color-orange-4)"}`,
        background: "var(--mantine-color-white)",
        minWidth: 140,
        boxShadow: selected ? "0 0 0 2px var(--mantine-color-blue-2)" : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          width: 10,
          height: 10,
          background: "var(--mantine-color-orange-5)",
          border: "2px solid var(--mantine-color-white)",
        }}
      />
      <Text size="xs" c="dimmed" fw={600} mb={2}>
        Destination
      </Text>
      <Text size="sm" fw={500} truncate>
        {nodeData.fieldPath}
      </Text>
      {nodeData.required && (
        <Badge size="xs" variant="light" color="danger" mt={4}>
          required
        </Badge>
      )}
      {nodeData.fieldType && (
        <Badge size="xs" variant="light" color="slate" mt={4} ml={nodeData.required ? 4 : 0}>
          {nodeData.fieldType}
        </Badge>
      )}
    </div>
  );
}
