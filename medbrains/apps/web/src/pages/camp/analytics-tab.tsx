// CAMP CampAnalyticsTab — split from camp.tsx (pure move).

import { BarChart } from "@mantine/charts";
import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type {
  Camp,
  CampAnalytics as CampAnalyticsType,
  CampReport as CampReportType,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { campService } from "@/services/camp.service";
import { StatCard } from "./shared";

export function CampAnalyticsTab({
  campId,
  selectedCamp,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
}) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["camp-analytics"],
    queryFn: () => campService.campAnalytics(),
  });

  const { data: report } = useQuery({
    queryKey: ["camp-report", campId],
    queryFn: () => campService.campReport(campId ?? ""),
    enabled: !!campId,
  });

  const stats = analytics as CampAnalyticsType | undefined;
  const campReport = report as CampReportType | undefined;

  const chartData = stats?.by_type
    ? Object.entries(stats.by_type).map(([type, count]) => ({
        type: type.replace(/_/g, " "),
        camps: count,
      }))
    : [];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Camp Analytics
      </Text>
      {analyticsLoading && (
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      )}

      {stats && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
            <StatCard label="Total Camps" value={stats.total_camps} />
            <StatCard label="Total Registrations" value={stats.total_registrations} />
            <StatCard label="Total Screenings" value={stats.total_screened} />
            <StatCard
              label="Conversion Rate"
              value={Math.round(stats.conversion_rate_pct)}
              prefix=""
            />
            <StatCard
              label="Avg Cost/Patient"
              value={Math.round(stats.avg_cost_per_patient)}
              prefix="₹"
            />
            <StatCard
              label="Followup Compliance"
              value={Math.round(stats.followup_compliance_pct)}
              prefix=""
            />
          </SimpleGrid>

          {chartData.length > 0 && (
            <Card withBorder p="md" mt="md">
              <Text fw={600} size="sm" mb="md">
                Camps by Type
              </Text>
              <BarChart
                h={250}
                data={chartData}
                dataKey="type"
                series={[{ name: "camps", color: "teal" }]}
              />
            </Card>
          )}
        </>
      )}

      <Text fw={600} size="lg" mt="lg">
        Camp Report
      </Text>
      <Text size="xs" c="dimmed">
        {selectedCamp
          ? `${selectedCamp.camp_code} · ${selectedCamp.name}`
          : "Open a camp workspace for the per-camp report."}
      </Text>

      {campReport && (
        <Card withBorder p="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
            <StatCard label="Registrations" value={campReport.stats.total_registrations} />
            <StatCard label="Screenings" value={campReport.stats.total_screenings} />
            <StatCard label="Referred" value={campReport.stats.referred} />
            <StatCard label="Follow-ups" value={campReport.stats.followups_total} />
            <StatCard label="Billing Total" value={campReport.stats.billing_total} prefix="₹" />
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}
