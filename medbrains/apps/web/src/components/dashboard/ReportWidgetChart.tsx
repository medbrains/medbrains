import { BarChart, LineChart } from "@mantine/charts";
import { Group, Loader, Text } from "@mantine/core";
import type { ReportSeries } from "@/pages/reports/report-series";

const PALETTE = [
  "primary.6",
  "teal.6",
  "orange.6",
  "grape.6",
  "cyan.6",
  "pink.6",
  "lime.6",
  "yellow.6",
];

interface Props {
  shape: ReportSeries | null;
  loading: boolean;
  failed: boolean;
  h?: number;
}

/** A report's chart in a dashboard widget: the reports page's reading, drawn small. */
export function ReportWidgetChart({ shape, loading, failed, h = 200 }: Props) {
  if (loading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    );
  }
  if (failed) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Couldn't load this report. This is a failed request, not an empty one.
      </Text>
    );
  }
  if (!shape) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No data in the last 30 days.
      </Text>
    );
  }
  const data = shape.x.map((x, i) =>
    Object.fromEntries([["x", x], ...shape.series.map((s) => [s.name, s.values[i] ?? null])]),
  );
  const series = shape.series.map((s, i) => ({
    name: s.name,
    color: PALETTE[i % PALETTE.length] ?? "primary.6",
  }));
  const common = {
    h,
    data,
    dataKey: "x",
    series,
    withLegend: series.length > 1,
    gridAxis: "x" as const,
    yAxisProps: { domain: [0, "auto"] as [number, string] },
  };
  return shape.isTrend ? (
    <LineChart {...common} curveType="linear" connectNulls />
  ) : (
    <BarChart {...common} />
  );
}
