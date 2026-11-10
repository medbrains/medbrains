import { LineChart } from "@mantine/charts";
import { Group, Stack, Text } from "@mantine/core";
import type { PaperlessDay } from "@medbrains/types";
import { useMemo, useState } from "react";
import { shortDate } from "@/components/dashboard/chart-format";
import { Card, SegmentedControl, Table } from "@/components/ui";
import { formatShare } from "./labels";

interface TrendCardProps {
  series: PaperlessDay[];
}

/** The share on a day, or the reason it has none. */
function dayShare(day: PaperlessDay, pct: number | null): string {
  return day.measured ? formatShare(pct) : "Not counted";
}

/** The same days as rows, for readers who cannot use the chart. */
function TrendTable({ series }: TrendCardProps) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table data-testid="paperless-trend-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Day</Table.Th>
            <Table.Th>Made in system</Table.Th>
            <Table.Th>Signed</Table.Th>
            <Table.Th>Signed share</Table.Th>
            <Table.Th>Made in system share</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {series.map((d) => (
            <Table.Tr key={d.date}>
              <Table.Td>{shortDate(d.date)}</Table.Td>
              <Table.Td>{d.counts ? d.counts.created : "—"}</Table.Td>
              <Table.Td>{d.counts ? d.counts.signed : "—"}</Table.Td>
              <Table.Td>{dayShare(d, d.signed_pct)}</Table.Td>
              <Table.Td>{dayShare(d, d.digital_pct)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/**
 * The daily shares over the range, zero-based to 100%. A day not counted or
 * with no documents is a gap, never a drop to 0; the two lines differ by
 * dash and by name, not by colour alone. The table shows the same numbers.
 */
export function TrendCard({ series }: TrendCardProps) {
  const [view, setView] = useState("chart");
  const data = useMemo(
    () => series.map((d) => ({ date: d.date, signed: d.signed_pct, digital: d.digital_pct })),
    [series],
  );
  return (
    <Card padding="md" pattern={false} data-testid="paperless-trend">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>By day</Text>
          <SegmentedControl
            aria-label="Show the trend as"
            value={view}
            onChange={setView}
            data={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </Group>
        {view === "chart" ? (
          <LineChart
            h={240}
            data={data}
            dataKey="date"
            series={[
              { name: "signed", label: "Signed digitally", color: "primary.6" },
              {
                name: "digital",
                label: "Made in the system",
                color: "purple.6",
                strokeDasharray: "6 4",
              },
            ]}
            withLegend
            curveType="linear"
            connectNulls={false}
            yAxisProps={{ domain: [0, 100] }}
            xAxisProps={{ tickFormatter: shortDate }}
            valueFormatter={(v) => `${Math.round(v)}%`}
            aria-label="Signed and made-in-system shares by day; the table view lists every day"
          />
        ) : (
          <TrendTable series={series} />
        )}
      </Stack>
    </Card>
  );
}
