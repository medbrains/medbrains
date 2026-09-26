// Visitor analytics — who came, to which ward, at what hour.

import { BarChart } from "@mantine/charts";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { DatePickerInput, type DatesRangeValue } from "@mantine/dates";
import type { VisitorAnalytics } from "@medbrains/types";
import { IconCalendar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Card } from "@/components/ui";
import { frontOfficeService } from "@/services/frontOffice.service";

export function VisitorAnalyticsTab() {
  // Empty means the server's default: the hospital's last 30 days.
  const [range, setRange] = useState<DatesRangeValue<string>>([null, null]);
  const [from, to] = range;
  const complete = (from === null) === (to === null);

  const analytics = useQuery<VisitorAnalytics>({
    queryKey: ["front-office", "visitor-analytics", from, to],
    queryFn: () =>
      frontOfficeService.visitorAnalytics({ from: from ?? undefined, to: to ?? undefined }),
    enabled: complete,
  });
  const data = analytics.data;

  return (
    <Stack gap="md">
      <DatePickerInput
        type="range"
        label="Dates"
        placeholder="Last 30 days"
        value={range}
        onChange={setRange}
        clearable
        leftSection={<IconCalendar size={16} aria-hidden />}
        w={280}
        data-testid="picker-visitor-dates"
      />
      {analytics.isError && (
        <Alert tone="danger">Visitor figures could not be loaded. Try again shortly.</Alert>
      )}
      {analytics.isLoading && (
        <Text size="sm" c="dimmed">
          Loading visitor figures…
        </Text>
      )}
      {data && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card>
              <Text size="xs" c="dimmed">
                Visitors, {data.from} to {data.to}
              </Text>
              <Text size="xl" fw={700} data-testid="stat-total-visitors">
                {data.total_visitors}
              </Text>
            </Card>
            <Card>
              <Text size="xs" c="dimmed">
                Average visit
              </Text>
              <Text size="xl" fw={700}>
                {data.avg_visit_minutes === null
                  ? "No check-outs yet"
                  : `${Math.round(data.avg_visit_minutes)} min`}
              </Text>
            </Card>
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <VisitorChart
              title="Visitors by ward"
              rows={data.by_ward.map((row) => ({
                label: row.ward ?? "No ward",
                visitors: row.visitors,
              }))}
            />
            <VisitorChart
              title="Check-ins by hour"
              rows={data.by_hour.map((row) => ({
                label: `${String(row.hour).padStart(2, "0")}:00`,
                visitors: row.visitors,
              }))}
            />
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

interface VisitorChartProps {
  title: string;
  rows: { label: string; visitors: number }[];
}

function VisitorChart({ title, rows }: VisitorChartProps) {
  return (
    <Card>
      <Text fw={600} size="sm" mb="sm">
        {title}
      </Text>
      {rows.length > 0 ? (
        <BarChart
          h={220}
          data={rows}
          dataKey="label"
          series={[{ name: "visitors", label: "Visitors", color: "primary" }]}
        />
      ) : (
        <Text size="sm" c="dimmed">
          No visitors in these dates.
        </Text>
      )}
    </Card>
  );
}
