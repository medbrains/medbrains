// IPD OccHealthAnalyticsPanel — split from occupational-health.tsx (pure move).

import { BarChart, DonutChart } from "@mantine/charts";
import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { FITNESS_STATUS_COLORS, SCREENING_TYPES } from "./shared";

export function OccHealthAnalyticsPanel() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["occ-health-analytics"],
    queryFn: () => occupationalHealthService.occHealthAnalytics(),
  });

  if (isLoading) {
    return (
      <Text c="dimmed" size="sm">
        Loading analytics...
      </Text>
    );
  }

  if (!analytics) {
    return (
      <Text c="dimmed" size="sm">
        No analytics data available
      </Text>
    );
  }

  const byTypeData = Object.entries(analytics.by_type ?? {}).map(([type, count]) => ({
    type: SCREENING_TYPES.find((t) => t.value === type)?.label ?? type,
    count,
  }));

  const fitnessData = Object.entries(analytics.fitness_rates ?? {}).map(([status, rate]) => ({
    name: status,
    value: Math.round((rate as number) * 100),
    color: FITNESS_STATUS_COLORS[status] ?? "gray",
  }));

  const byDeptData = Object.entries(analytics.by_department ?? {}).map(([dept, count]) => ({
    department: dept,
    count,
  }));

  return (
    <Stack gap="lg">
      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Total Screenings
          </Text>
          <Text fw={700} size="xl" c="primary">
            {analytics.total_screenings ?? 0}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Screening Types
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.by_type ?? {}).length}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Departments Covered
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.by_department ?? {}).length}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Fitness Statuses Tracked
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.fitness_rates ?? {}).length}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Charts */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {byTypeData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">
              Screenings by Type
            </Text>
            <BarChart
              h={250}
              data={byTypeData}
              dataKey="type"
              series={[{ name: "count", label: "Count", color: "primary" }]}
            />
          </Card>
        )}
        {fitnessData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">
              Fitness Rate Distribution (%)
            </Text>
            <DonutChart
              data={fitnessData}
              size={200}
              thickness={30}
              paddingAngle={4}
              withLabelsLine
              withLabels
            />
          </Card>
        )}
      </SimpleGrid>

      {byDeptData.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} size="sm" mb="md">
            Screenings by Department
          </Text>
          <BarChart
            h={300}
            data={byDeptData}
            dataKey="department"
            series={[{ name: "count", label: "Count", color: "teal" }]}
          />
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 7 — Return-to-Work Clearance
// ══════════════════════════════════════════════════════════
