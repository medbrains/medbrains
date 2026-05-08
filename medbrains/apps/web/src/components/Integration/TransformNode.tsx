import { Box, Card, Group, Text, ThemeIcon } from "@mantine/core";
import { IconCircleFilled, IconTransform } from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";

interface TransformNodeData {
  label?: string;
  icon?: string;
  color?: string;
  templateCode?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export function TransformNode({ data, selected }: NodeProps) {
  const d = data as TransformNodeData;
  const color = d.color ?? "violet";
  const config = (d.config ?? {}) as Record<string, unknown>;
  const mappings = config.mappings as unknown[] | undefined;
  const mapCount = mappings?.length ?? 0;
  const configured = mapCount > 0;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 10,
          height: 10,
          background: `var(--mantine-color-${color}-5)`,
          border: "2px solid white",
        }}
      />
      <Card
        shadow={selected ? "lg" : "sm"}
        padding="sm"
        radius="md"
        withBorder
        style={{
          borderColor: selected
            ? `var(--mantine-color-${color}-5)`
            : `var(--mantine-color-${color}-2)`,
          borderWidth: selected ? 2 : 1,
          minWidth: 200,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color={color} size="lg" radius="md">
            <IconTransform size={18} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                {String(d.label ?? "Transform")}
              </Text>
              <IconCircleFilled
                size={8}
                color={configured ? "var(--mantine-color-green-5)" : "var(--mantine-color-gray-4)"}
              />
            </Group>
            {mapCount > 0 && (
              <Text size="xs" c="dimmed">
                {mapCount} mapping{mapCount !== 1 ? "s" : ""}
              </Text>
            )}
          </Box>
        </Group>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 10,
          height: 10,
          background: `var(--mantine-color-${color}-5)`,
          border: "2px solid white",
        }}
      />
    </>
  );
}
