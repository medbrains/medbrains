// IPD AnalyticsTab — split from icu.tsx (pure move).

import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DeviceInfectionRate } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { icuService } from "@/services/icu.service";

export function AnalyticsTab() {
  const { data: losData, isLoading: loadingLos } = useQuery({
    queryKey: ["icu-los-analytics"],
    queryFn: () => icuService.getIcuLosAnalytics(),
  });

  const { data: infectionRates = [], isLoading: loadingInfections } = useQuery({
    queryKey: ["icu-device-infection-rates"],
    queryFn: () => icuService.getIcuDeviceInfectionRates(),
  });

  const infectionColumns = [
    {
      key: "device_type",
      label: "Device Type",
      render: (r: DeviceInfectionRate) => r.device_type.replace(/_/g, " "),
    },
    {
      key: "total_device_days",
      label: "Total Device Days",
      render: (r: DeviceInfectionRate) => String(r.total_device_days),
    },
    {
      key: "infection_count",
      label: "Infections",
      render: (r: DeviceInfectionRate) => String(r.infection_count),
    },
    {
      key: "rate_per_1000",
      label: "Rate per 1,000 Days",
      render: (r: DeviceInfectionRate) =>
        r.rate_per_1000 != null ? r.rate_per_1000.toFixed(2) : "—",
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        LOS & Readmission Analytics
      </Text>
      {loadingLos ? (
        <Text c="dimmed" size="sm">
          Loading...
        </Text>
      ) : losData ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Admissions
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.total_admissions}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Avg LOS (days)
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.avg_los_days != null ? losData.avg_los_days.toFixed(1) : "—"}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Median LOS (days)
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.median_los_days != null ? losData.median_los_days.toFixed(1) : "—"}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Readmissions (30d)
            </Text>
            <Text
              size="xl"
              fw={700}
              c={losData.readmission_count > 0 ? "orange" : "success"}
              mt={4}
            >
              {losData.readmission_count}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Readmission Rate
            </Text>
            <Text
              size="xl"
              fw={700}
              c={
                losData.readmission_rate != null && losData.readmission_rate > 10
                  ? "danger"
                  : "success"
              }
              mt={4}
            >
              {losData.readmission_rate != null ? `${losData.readmission_rate.toFixed(1)}%` : "—"}
            </Text>
          </Paper>
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">
          No analytics data available
        </Text>
      )}

      <Text fw={600} size="lg" mt="md">
        Device Infection Rates
      </Text>
      <DataTable
        columns={infectionColumns}
        data={infectionRates}
        loading={loadingInfections}
        rowKey={(r) => r.device_type}
        emptyTitle="No device infection data"
      />
    </Stack>
  );
}

// ── Main ICU Page ───────────────────────────────────────────
