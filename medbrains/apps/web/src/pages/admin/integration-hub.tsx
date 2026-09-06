import { Card, Code, Group, List, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconInfoCircle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Switch, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { integrationService } from "@/services/integration.service";

export function IntegrationHubPage() {
  useRequirePermission(P.INTEGRATION.LIST);
  const canToggle = useHasPermission(P.INTEGRATION.PIPELINES_TOGGLE);
  const queryClient = useQueryClient();

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["default-pipelines"],
    queryFn: () => integrationService.listDefaultPipelines(),
  });

  const toggle = useMutation({
    mutationFn: ({ eventType, disabled }: { eventType: string; disabled: boolean }) =>
      integrationService.setDefaultPipelineEnabled(eventType, disabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["default-pipelines"] });
    },
  });

  return (
    <Stack gap="md" p="md">
      <PageHeader
        title="Built-in Pipelines"
        subtitle="Hardcoded Rust subscribers — code-reviewed, version-controlled, idempotent."
      />

      <Alert icon={<IconInfoCircle size={16} />} tone="info" title="Pipelines are code, not config">
        Cross-module workflows live in <Code>orchestration/default_pipelines.rs</Code>. Each
        subscriber writes to the outbox with a stable idempotency key, so retries and accidental
        double-fires never produce duplicate side effects. To customise behaviour per tenant, use{" "}
        <Text span fw={600}>
          Settings → Pipeline Settings
        </Text>{" "}
        Which of them run for this hospital is set in the Status column below, and is the only
        per-tenant control: the pipelines themselves are code, and a hospital that needs different
        behaviour needs a reviewed change, not a switch.
      </Alert>

      {/* A rejected toggle otherwise just snaps the switch back on refetch,
          which reads as "it didn't take" rather than "you may not do that". */}
      {toggle.isError && (
        <Alert tone="danger" title="That pipeline could not be changed">
          {(toggle.error as Error).message}
        </Alert>
      )}

      <Card withBorder shadow="sm" radius="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Group justify="space-between">
            <Text fw={600}>Active subscribers</Text>
            <Badge>{pipelines.length} built-in</Badge>
          </Group>
        </Card.Section>

        <Table verticalSpacing="sm" highlightOnHover mt="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Trigger event</Table.Th>
              <Table.Th>What it does</Table.Th>
              <Table.Th style={{ width: 180 }}>Status</Table.Th>
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
                  {canToggle ? (
                    <Switch
                      checked={!p.disabled_for_tenant}
                      disabled={toggle.isPending}
                      onChange={(event) =>
                        toggle.mutate({
                          eventType: p.event_type,
                          disabled: !event.currentTarget.checked,
                        })
                      }
                      label={p.disabled_for_tenant ? "Disabled" : "Active"}
                      aria-label={`${p.disabled_for_tenant ? "Enable" : "Disable"} ${p.description}`}
                    />
                  ) : p.disabled_for_tenant ? (
                    <Badge tone="neutral">Disabled</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
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
          <List type="ordered" size="sm" c="dimmed" spacing="xs">
            <List.Item>Open an issue describing the trigger event and its side effects.</List.Item>
            <List.Item>
              Write an <Code>on_&lt;event&gt;</Code> function in <Code>default_pipelines.rs</Code>{" "}
              with a stable idempotency key.
            </List.Item>
            <List.Item>
              Add one row to <Code>PIPELINES</Code> — the event, this description, and the function.
              There is no second list to keep in step.
            </List.Item>
            <List.Item>Add a unit test, code review, merge, deploy.</List.Item>
          </List>
          <Text size="xs" c="dimmed">
            Every pipeline is independent: its own transaction, its own failure. One erroring does
            not stop the others registered for the same event. The dynamic graph builder has been
            retired — cross-module logic must be auditable in <Code>git log</Code>, not edited at 2
            AM.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
