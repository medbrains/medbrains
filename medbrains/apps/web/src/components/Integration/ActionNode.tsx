import { Badge, Box, Card, Group, Text, ThemeIcon } from "@mantine/core";
import { IconCircleFilled, IconPlayerPlay } from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";

interface ActionNodeData {
  label?: string;
  icon?: string;
  color?: string;
  templateCode?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

function getConfigSummary(
  code: string | undefined,
  config: Record<string, unknown>,
): string | null {
  if (!code) return null;
  if (code === "action.create_indent" && config.indent_type)
    return `${String(config.indent_type)} indent`;
  if (code === "action.create_order") return "pharmacy order";
  if (code === "action.send_notification" && config.channel) return String(config.channel);
  if (code === "action.webhook_call" && config.url) return String(config.url).slice(0, 30);
  if (code === "action.update_record" && config.entity) return String(config.entity);
  return null;
}

function isConfigured(config: Record<string, unknown>): boolean {
  return Object.values(config).some((v) => v !== null && v !== undefined && v !== "");
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as ActionNodeData;
  const color = d.color ?? "teal";
  const config = (d.config ?? {}) as Record<string, unknown>;
  const summary = getConfigSummary(d.templateCode as string | undefined, config);
  const configured = isConfigured(config);

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
          borderLeft: `4px solid var(--mantine-color-${color}-5)`,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color={color} size="lg" radius="md">
            <IconPlayerPlay size={18} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                {String(d.label ?? "Action")}
              </Text>
              <IconCircleFilled
                size={8}
                color={configured ? "var(--mantine-color-green-5)" : "var(--mantine-color-gray-4)"}
              />
            </Group>
            {summary && (
              <Badge size="xs" variant="light" color={color} mt={4}>
                {summary}
              </Badge>
            )}
            {!summary && d.templateCode && (
              <Text size="xs" c="dimmed" truncate>
                {String(d.templateCode).replace("action.", "")}
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
