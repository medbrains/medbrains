/**
 * Health → Intelligence (RFC-OSINT §5). What this hospital is seeing this
 * week against its own usual, public outbreak notices for its region, and
 * weather and air advisories — with every feed and recompute behind them.
 *
 * Aggregate only, small counts suppressed. A failed read is an error with a
 * retry, never "nothing unusual".
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ChecksLine } from "./health-intel/checks-line";
import { ConditionsCard } from "./health-intel/conditions-card";
import { EnvironmentCard } from "./health-intel/environment-card";
import { NoticesCard } from "./health-intel/notices-card";

export function HealthIntelPage() {
  useRequirePermission(P.HEALTH.INTEL.VIEW);
  const canView = useHasPermission(P.HEALTH.INTEL.VIEW);
  const intel = useQuery({
    queryKey: ["health-intel"],
    queryFn: () => api.getHealthIntel(),
    enabled: canView,
  });
  const refresh = (
    <Button
      tone="secondary"
      leftSection={<IconRefresh size={16} />}
      loading={intel.isFetching}
      onClick={() => void intel.refetch()}
    >
      Check again
    </Button>
  );
  const data = intel.data;
  const conditionsJob = data?.checks.find((c) => c.name === "job:health_conditions");
  const hasStoppedFeed = !!data?.checks.some((c) => c.kind === "feed" && c.state !== "running");

  return (
    <Stack gap="md">
      <PageHeader
        title="Health intelligence"
        subtitle="What this hospital is seeing against its usual, and what is happening around it"
        actions={canView ? refresh : undefined}
      />
      {intel.isLoading && (
        <Text size="sm" c="dimmed" data-testid="health-intel-loading">
          Loading health intelligence…
        </Text>
      )}
      {intel.isError && (
        <Alert
          tone="danger"
          title="Health intelligence is unavailable"
          data-testid="health-intel-error"
        >
          <Group justify="space-between" align="center">
            <Text size="sm">
              The server did not answer, so nothing here can be confirmed. This does not mean
              nothing is unusual.
            </Text>
            {refresh}
          </Group>
        </Alert>
      )}
      {data && (
        <>
          <ChecksLine checks={data.checks} />
          <ConditionsCard
            conditions={data.conditions}
            computedAt={data.computed_at}
            isStale={conditionsJob?.state !== "running"}
          />
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <NoticesCard
              notices={data.notices}
              region={data.region}
              hasStoppedFeed={hasStoppedFeed}
            />
            <EnvironmentCard environment={data.environment} />
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
