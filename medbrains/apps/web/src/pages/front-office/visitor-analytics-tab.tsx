// IPD VisitorAnalyticsTab — split from front-office.tsx (pure move).

import { BarChart } from "@mantine/charts";
import { Card, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import type { VisitorAnalytics } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { frontOfficeService } from "@/services/frontOffice.service";

export function VisitorAnalyticsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: analytics, isLoading } = useQuery<VisitorAnalytics>({
    queryKey: ["front-office", "visitor-analytics", from, to],
    queryFn: () =>
      frontOfficeService.visitorAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const byDeptChart = analytics
    ? Object.entries(analytics.by_department).map(([dept, count]) => ({
        department: dept,
        visitors: count,
      }))
    : [];

  const byHourChart = analytics
    ? Object.entries(analytics.by_hour).map(([hour, count]) => ({
        hour,
        visitors: count,
      }))
    : [];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
          w={160}
        />
        <TextInput
          placeholder="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
          w={160}
        />
      </Group>

      {isLoading && (
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      )}

      {analytics && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Total Visitors
              </Text>
              <Text size="xl" fw={700} c="primary">
                {analytics.total_visitors}
              </Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Avg Visit Duration
              </Text>
              <Text size="xl" fw={700} c="orange">
                {Math.round(analytics.avg_visit_duration_minutes)} min
              </Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Department
              </Text>
              {byDeptChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byDeptChart}
                  dataKey="department"
                  series={[{ name: "visitors", color: "primary" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Hour
              </Text>
              {byHourChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byHourChart}
                  dataKey="hour"
                  series={[{ name: "visitors", color: "teal" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Queue Metrics
// ══════════════════════════════════════════════════════════
