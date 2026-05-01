import { Alert, Badge, Card, Group, Stack, Table, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function IntegrationHubPage() {
  useRequirePermission(P.INTEGRATION.LIST);

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["default-pipelines"],
    queryFn: () => api.listDefaultPipelines(),
  });

  return (
    <Stack gap="md" p="md">
      <PageHeader
        title="Built-in Pipelines"
        subtitle="Hardcoded Rust subscribers — code-reviewed, version-controlled, idempotent."
      />

      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        variant="light"
        title="Pipelines are code, not config"
      >
        Cross-module workflows live in <code>orchestration/default_pipelines.rs</code>. Each
        subscriber writes to the outbox with a stable idempotency key, so retries and
        accidental double-fires never produce duplicate side effects. To customise behaviour
        per tenant, use <strong>Settings → Pipeline Settings</strong> (template ids, recipient
        lists, thresholds). To disable a subscriber for one tenant, add the event_type to the
        <code>default_pipelines.disabled</code> array in tenant_settings.
      </Alert>

      <Card withBorder shadow="sm" radius="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Group justify="space-between">
            <Text fw={600}>Active subscribers</Text>
            <Badge variant="light">{pipelines.length} built-in</Badge>
          </Group>
        </Card.Section>

        <Table verticalSpacing="sm" highlightOnHover mt="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Trigger event</Table.Th>
              <Table.Th>What it does</Table.Th>
              <Table.Th style={{ width: 140 }}>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    Loading…
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {!isLoading && pipelines.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    No built-in pipelines registered.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {pipelines.map((p) => (
              <Table.Tr key={p.event_type}>
                <Table.Td>
                  <Text ff="monospace" size="xs">
                    {p.event_type}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{p.description}</Text>
                </Table.Td>
                <Table.Td>
                  {p.disabled_for_tenant ? (
                    <Badge color="gray" variant="light">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge color="green" variant="light">
                      Active
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder radius="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            How a new pipeline gets added
          </Text>
          <Text size="sm" c="dimmed">
            1. Open an issue describing the trigger event + side effects.
            <br />
            2. Add a new arm to <code>match event_type</code> in <code>default_pipelines.rs</code>
            .
            <br />
            3. Implement the handler (~30–60 LoC) with a stable idempotency key.
            <br />
            4. Add a unit test, code review, merge, deploy.
          </Text>
          <Text size="xs" c="dimmed">
            Total: 2–4 hours per new pipeline. The dynamic graph builder has been retired —
            cross-module logic must be auditable in <code>git log</code>, not edited at 2 AM.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
