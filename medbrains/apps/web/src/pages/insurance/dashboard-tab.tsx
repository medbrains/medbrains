// Insurance DashboardTab — split from insurance.tsx (pure move).

import { Grid, Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { InsuranceDashboard } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components";
import { Badge } from "@/components/ui";
import { insuranceService } from "@/services/insurance.service";

export function DashboardTab() {
  const canView = useHasPermission(P.INSURANCE.DASHBOARD_VIEW);
  const { data, isLoading } = useQuery({
    queryKey: ["insurance-dashboard"],
    queryFn: () => insuranceService.getInsuranceDashboard(),
    enabled: canView,
  });

  if (isLoading || !data) return <Text>Loading dashboard...</Text>;

  const d: InsuranceDashboard = data;
  const approvalRate =
    d.total_prior_auths > 0 ? (d.approved_prior_auths / d.total_prior_auths) * 100 : 0;

  return (
    <Stack gap="md">
      <PageHeader title="Insurance Dashboard" subtitle="Key metrics and trends" />

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Total Verifications
            </Text>
            <Title order={3}>{d.total_verifications}</Title>
            <Text size="xs" c="success">
              {d.active_verifications} active
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Active PAs
            </Text>
            <Title order={3}>{d.pending_prior_auths}</Title>
            <Text size="xs" c="dimmed">
              of {d.total_prior_auths} total
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Denial Rate
            </Text>
            <Title order={3}>{d.denial_rate_percent.toFixed(1)}%</Title>
            <Progress value={d.denial_rate_percent} color="danger" size="sm" mt="xs" />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Pending Appeals
            </Text>
            <Title order={3}>{d.pending_appeals}</Title>
            <Text size="xs" c="dimmed">
              Avg TAT: {d.avg_tat_hours != null ? `${d.avg_tat_hours.toFixed(1)}h` : "—"}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* PA Status Breakdown */}
      <Paper p="md" withBorder>
        <Title order={5} mb="sm">
          PA Status Breakdown
        </Title>
        <Group gap="lg">
          <Group gap="xs">
            <Badge tone="success" variant="dot" />
            <Text size="sm">
              Approved: {d.approved_prior_auths} ({approvalRate.toFixed(1)}%)
            </Text>
          </Group>
          <Group gap="xs">
            <Badge tone="danger" variant="dot" />
            <Text size="sm">Denied: {d.denied_prior_auths}</Text>
          </Group>
          <Group gap="xs">
            <Badge tone="primary" variant="dot" />
            <Text size="sm">Pending: {d.pending_prior_auths}</Text>
          </Group>
        </Group>
        <Progress.Root size="lg" mt="sm">
          {d.total_prior_auths > 0 && (
            <>
              <Progress.Section
                value={(d.approved_prior_auths / d.total_prior_auths) * 100}
                color="success"
              />
              <Progress.Section
                value={(d.denied_prior_auths / d.total_prior_auths) * 100}
                color="danger"
              />
              <Progress.Section
                value={(d.pending_prior_auths / d.total_prior_auths) * 100}
                color="primary"
              />
            </>
          )}
        </Progress.Root>
      </Paper>

      <Grid>
        {/* Top Denial Reasons */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Title order={5} mb="sm">
              Top Denial Reasons
            </Title>
            <Stack gap="xs">
              {d.top_denial_reasons.length === 0 && (
                <Text size="sm" c="dimmed">
                  No denials yet
                </Text>
              )}
              {d.top_denial_reasons.map((r) => (
                <Group key={r.reason} justify="space-between">
                  <Text size="sm">{r.reason}</Text>
                  <Badge variant="outline" tone="neutral">
                    {r.count}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Expiring Soon */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <Title order={5} mb="sm">
              Expiring Soon (7 days)
            </Title>
            <Stack gap="xs">
              {d.expiring_soon.length === 0 && (
                <Text size="sm" c="dimmed">
                  No PAs expiring soon
                </Text>
              )}
              {d.expiring_soon.map((pa) => (
                <Group key={pa.id} justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {pa.pa_number}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {pa.service_type}
                    </Text>
                  </Group>
                  <Text size="xs" c="orange">
                    Expires: {pa.expires_at ? new Date(pa.expires_at).toLocaleDateString() : "—"}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
