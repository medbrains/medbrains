import { Select, Text } from "@mantine/core";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type { CombinerNodeData } from "@/components/Integration/mapperSync";

const COMBINE_OPTIONS = [
  { value: "concat", label: "Concat" },
  { value: "fallback", label: "Fallback" },
  { value: "template", label: "Template" },
  { value: "arithmetic", label: "Arithmetic" },
];

export function CombinerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CombinerNodeData;
  const inputCount = nodeData.sourceCount || 2;

  return (
    <div
      style={{
        borderRadius: 8,
        border: `2px solid ${selected ? "var(--mantine-color-violet-5)" : "var(--mantine-color-violet-3)"}`,
        background: "var(--mantine-color-white)",
        minWidth: 160,
        boxShadow: selected
          ? "0 0 0 2px var(--mantine-color-violet-2)"
          : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          background: "var(--mantine-color-violet-0)",
          borderBottom: "1px solid var(--mantine-color-violet-2)",
        }}
      >
        <Text size="xs" fw={600} c="violet">
          Combiner
        </Text>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <Select
          size="xs"
          data={COMBINE_OPTIONS}
          value={nodeData.combineMode ?? "concat"}
          readOnly
          styles={{ input: { minHeight: 28 } }}
        />
        {nodeData.combineMode === "concat" && nodeData.separator !== undefined && (
          <Text size="xs" c="dimmed" mt={4}>
            sep: &quot;{nodeData.separator}&quot;
          </Text>
        )}
        {nodeData.combineMode === "template" && nodeData.templateStr && (
          <Text size="xs" c="dimmed" mt={4} truncate>
            {nodeData.templateStr}
          </Text>
        )}
        {nodeData.combineMode === "arithmetic" && nodeData.expression && (
          <Text size="xs" c="dimmed" mt={4} truncate>
            {nodeData.expression}
          </Text>
        )}
      </div>

      {/* Multiple input handles */}
      {Array.from({ length: inputCount }).map((_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`input-${i}`}
          style={{
            width: 10,
            height: 10,
            background: "var(--mantine-color-violet-5)",
            border: "2px solid var(--mantine-color-white)",
            top: `${30 + i * 30}px`,
          }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: 10,
          height: 10,
          background: "var(--mantine-color-violet-5)",
          border: "2px solid var(--mantine-color-white)",
        }}
      />
    </div>
  );
}
