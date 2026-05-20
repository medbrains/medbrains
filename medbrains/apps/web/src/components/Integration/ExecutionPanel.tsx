import {
  Badge,
  Box,
  Card,
  Code,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import type { ExecutionStatus, IntegrationExecution } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { integrationService } from "../../services/integration.service";

interface ExecutionPanelProps {
  pipelineId: string | null;
  opened: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  pending: "slate",
  running: "primary",
  completed: "success",
  failed: "danger",
  skipped: "warning",
};

function formatTime(ts: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function ExecutionPanel({ pipelineId, opened, onClose }: ExecutionPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["integration", "executions", pipelineId],
    queryFn: () => integrationService.listPipelineExecutions(pipelineId ?? "", { per_page: "50" }),
    enabled: opened && Boolean(pipelineId),
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Execution History" position="right" size="lg">
      <ScrollArea h="calc(100vh - 100px)">
        {isLoading && (
          <Box ta="center" py="xl">
            <Loader size="sm" />
          </Box>
        )}

        {data?.executions.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No executions yet.
          </Text>
        )}

        <Stack gap="sm">
          {data?.executions.map((exec: IntegrationExecution) => (
            <ExecutionCard key={exec.id} execution={exec} />
          ))}
        </Stack>
      </ScrollArea>
    </Drawer>
  );
}

function ExecutionCard({ execution }: { execution: IntegrationExecution }) {
  return (
    <Card padding="sm" radius="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Badge color={STATUS_COLORS[execution.status]} variant="light" size="sm">
          {execution.status}
        </Badge>
        <Text size="xs" c="dimmed">
          v{execution.pipeline_version}
        </Text>
      </Group>

      {execution.trigger_event && (
        <Text size="xs" c="dimmed" mb={4}>
          Event: {execution.trigger_event}
        </Text>
      )}

      <Group gap="lg">
        <Box>
          <Text size="xs" c="dimmed">
            Started
          </Text>
          <Text size="xs">{formatTime(execution.started_at)}</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">
            Completed
          </Text>
          <Text size="xs">{formatTime(execution.completed_at)}</Text>
        </Box>
      </Group>

      {execution.error && (
        <Code block mt="xs" c="danger" style={{ fontSize: 11 }}>
          {execution.error}
        </Code>
      )}
    </Card>
  );
}
