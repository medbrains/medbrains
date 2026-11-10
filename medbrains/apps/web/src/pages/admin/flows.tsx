/**
 * Admin → Flows (RFC-SOP-FLOWS): the library flows this hospital runs, each
 * with its published version and how many patients are on it now.
 */
import { Anchor, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { sopFlowsService } from "@/services/sopFlows.service";

export function FlowsPage() {
  useRequirePermission(P.FLOWS.VIEW);
  const canView = useHasPermission(P.FLOWS.VIEW);
  const flows = useQuery({ queryKey: ["flows"], queryFn: sopFlowsService.list, enabled: canView });
  return (
    <Stack gap="md">
      <PageHeader
        title="Flows"
        subtitle="The routes patients take, built from your SOPs. Flip switches; safety signals stay on."
      />
      {flows.isLoading && <Loader aria-label="Loading flows" />}
      {flows.error && (
        <Alert tone="danger" title="Could not load flows">
          <Stack gap="xs">
            <Text size="sm">{flows.error.message}</Text>
            <Group>
              <Button tone="secondary" size="xs" onClick={() => void flows.refetch()}>
                Try again
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
      {flows.data?.length === 0 && <Text>No library flows yet.</Text>}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {flows.data?.map((f) => (
          <Card key={f.code} withBorder padding="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>{f.name}</Text>
                <Badge tone={f.version ? "success" : "neutral"}>
                  {f.version ? `Published · version ${f.version}` : "Not used yet: runs as shipped"}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {f.module} · {f.in_flight} {f.in_flight === 1 ? "patient" : "patients"} on it now
              </Text>
              <Group gap="md">
                <Anchor component={Link} to={`/admin/flows/${encodeURIComponent(f.code)}`}>
                  Switchboard
                </Anchor>
                <Anchor
                  component={Link}
                  to={`/admin/flows/${encodeURIComponent(f.code)}/control-room`}
                >
                  Control room
                </Anchor>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
