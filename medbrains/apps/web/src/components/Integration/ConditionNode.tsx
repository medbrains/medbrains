import { Badge, Box, Card, Group, Text, ThemeIcon } from "@mantine/core";
import { IconCircleFilled, IconGitBranch } from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";

interface ConditionNodeData {
  label?: string;
  icon?: string;
  color?: string;
  templateCode?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

function getConfigSummary(config: Record<string, unknown>): string | null {
  const field = config.field as string | undefined;
  const operator = config.operator as string | undefined;
  const value = config.value as string | undefined;
  if (field && operator) {
    const op = operator === "eq" ? "=" : operator === "neq" ? "!=" : operator;
    return `${field} ${op} ${value ?? ""}`.trim();
  }
  return null;
}

function isConfigured(config: Record<string, unknown>): boolean {
  return Boolean(config.field);
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  const color = d.color ?? "orange";
  const config = (d.config ?? {}) as Record<string, unknown>;
  const summary = getConfigSummary(config);
  const configured = isConfigured(config);

  return (
    <Box style={{ position: "relative" }}>
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
          minWidth: 220,
          background: `var(--mantine-color-${color}-0)`,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="filled" color={color} size="lg" radius="md">
            <IconGitBranch size={18} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                {String(d.label ?? "Condition")}
              </Text>
              <IconCircleFilled
                size={8}
                color={configured ? "var(--mantine-color-green-5)" : "var(--mantine-color-gray-4)"}
              />
            </Group>
            {summary && (
              <Badge size="xs" variant="light" color={color} mt={4} style={{ maxWidth: "100%" }}>
                {summary}
              </Badge>
            )}
          </Box>
        </Group>
      </Card>

      {/* True branch — left */}
      <Box
        style={{ position: "absolute", bottom: -22, left: "25%", transform: "translateX(-50%)" }}
      >
        <Text size="xs" fw={600} c="green.6" style={{ fontSize: 10 }}>
          Yes
        </Text>
      </Box>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{
          left: "25%",
          width: 10,
          height: 10,
          background: "var(--mantine-color-green-5)",
          border: "2px solid white",
        }}
      />

      {/* False branch — right */}
      <Box
        style={{ position: "absolute", bottom: -22, right: "25%", transform: "translateX(50%)" }}
      >
        <Text size="xs" fw={600} c="red.6" style={{ fontSize: 10 }}>
          No
        </Text>
      </Box>
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{
          left: "75%",
          width: 10,
          height: 10,
          background: "var(--mantine-color-red-5)",
          border: "2px solid white",
        }}
      />
    </Box>
  );
}
