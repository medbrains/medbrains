import { Group, Text } from "@mantine/core";
import { Badge, Card } from "@/components/ui";
import type { CheckStatus } from "./status";

interface HealthCardProps {
  title: string;
  status: CheckStatus;
}

/** One kernel check. The badge always carries a word, never colour alone. */
export function HealthCard({ title, status }: HealthCardProps) {
  return (
    <Card padding="md" withBorder>
      <Group justify="space-between" align="center" mb="xs">
        <Text fw={600}>{title}</Text>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {status.detail}
      </Text>
    </Card>
  );
}
