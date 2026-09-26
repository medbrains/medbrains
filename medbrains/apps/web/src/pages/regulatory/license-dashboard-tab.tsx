// REGULATORY LicenseDashboardTab — split from regulatory.tsx (pure move).

import { Card, Grid, Stack, Text, Title } from "@mantine/core";
import type { LicenseDashboardItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable, PageHeader } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

export function LicenseDashboardTab() {
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["regulatory-license-dashboard"],
    queryFn: () => regulatoryService.licenseDashboard(),
  });

  const renewalStatusColors: Record<string, BadgeTone> = {
    active: "success",
    expiring_soon: "warning",
    expired: "danger",
    pending_renewal: "primary",
    not_applicable: "neutral",
    pending: "neutral",
  };

  const expiredCount = licenses.filter(
    (l) => l.days_to_expiry != null && l.days_to_expiry < 0,
  ).length;
  const expiringSoonCount = licenses.filter(
    (l) => l.days_to_expiry != null && l.days_to_expiry >= 0 && l.days_to_expiry <= 90,
  ).length;
  const activeCount = licenses.filter(
    (l) => l.days_to_expiry == null || l.days_to_expiry > 90,
  ).length;

  return (
    <Stack gap="md">
      <PageHeader title="License Dashboard" subtitle="Hospital and department license tracking" />

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Active
            </Text>
            <Title order={2} c="success">
              {activeCount}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Expiring Soon (90d)
            </Text>
            <Title order={2} c="orange">
              {expiringSoonCount}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed">
              Expired
            </Text>
            <Title order={2} c="danger">
              {expiredCount}
            </Title>
          </Card>
        </Grid.Col>
      </Grid>

      <DataTable
        data={licenses}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "license_type",
            label: "License Type",
            render: (r: LicenseDashboardItem) => (
              <Text size="sm" fw={500}>
                {r.license_type}
              </Text>
            ),
          },
          {
            key: "license_number",
            label: "License #",
            render: (r: LicenseDashboardItem) => <Text size="sm">{r.license_number ?? "---"}</Text>,
          },
          {
            key: "valid_from",
            label: "Valid from",
            render: (r: LicenseDashboardItem) => (
              <Text size="sm">{r.valid_from ? r.valid_from.slice(0, 10) : "---"}</Text>
            ),
          },
          {
            key: "valid_until",
            label: "Expiry",
            render: (r: LicenseDashboardItem) =>
              r.valid_until ? (
                <Text
                  size="sm"
                  c={r.days_to_expiry != null && r.days_to_expiry < 30 ? "danger" : undefined}
                  fw={r.days_to_expiry != null && r.days_to_expiry < 30 ? 600 : undefined}
                >
                  {r.valid_until.slice(0, 10)}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  N/A
                </Text>
              ),
          },
          {
            key: "days_to_expiry",
            label: "Days Left",
            render: (r: LicenseDashboardItem) => {
              if (r.days_to_expiry == null)
                return (
                  <Text size="sm" c="dimmed">
                    N/A
                  </Text>
                );
              const color: BadgeTone =
                r.days_to_expiry < 0
                  ? "danger"
                  : r.days_to_expiry < 30
                    ? "danger"
                    : r.days_to_expiry < 90
                      ? "warning"
                      : "success";
              return (
                <Badge tone={color} size="lg">
                  {r.days_to_expiry < 0
                    ? `EXPIRED (${Math.abs(r.days_to_expiry)}d)`
                    : `${r.days_to_expiry}d`}
                </Badge>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (r: LicenseDashboardItem) => (
              <Badge tone={renewalStatusColors[r.status ?? ""] ?? "neutral"}>
                {(r.status ?? "pending").replaceAll("_", " ")}
              </Badge>
            ),
          },
          {
            key: "issuing_authority",
            label: "Issued by",
            render: (r: LicenseDashboardItem) => (
              <Text size="sm">{r.issuing_authority ?? "---"}</Text>
            ),
          },
        ]}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  NABL Documents Tab
// ══════════════════════════════════════════════════════════
