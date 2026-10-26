/**
 * One growth chart: the reference curves with the child's measurements on
 * them, and the same points as a table (never colour or shape alone).
 */
import { LineChart } from "@mantine/charts";
import "@mantine/charts/styles.css";
import { Stack, Text } from "@mantine/core";
import type { GrowthChart } from "@medbrains/types";
import { useMemo } from "react";
import { Badge, Table } from "@/components/ui";

interface GrowthChartViewProps {
  chart: GrowthChart;
}

const CHILD = "Child";

/** Outer lines lighter, the median darkest; dashed beyond the median. */
function lineColor(label: string): string {
  if (label === "Median" || label === "50th") return "gray.8";
  if (label.includes("3") || label.includes("27")) return "gray.5";
  return "gray.6";
}

function ageText(days: number): string {
  if (days < 61) return `${days} d`;
  const months = days / 30.4375;
  if (months < 24) return `${months.toFixed(1)} mo`;
  return `${Math.floor(days / 365.25)} y ${Math.floor((days % 365.25) / 30.4375)} mo`;
}

export function GrowthChartView({ chart }: GrowthChartViewProps) {
  const data = useMemo(() => {
    const rows = new Map<number, Record<string, number>>();
    const row = (x: number) => {
      const existing = rows.get(x);
      if (existing) return existing;
      const fresh: Record<string, number> = { x };
      rows.set(x, fresh);
      return fresh;
    };
    for (const line of chart.lines) {
      for (const [x, y] of line.points) row(x)[line.label] = y;
    }
    for (const p of chart.points) row(p.x)[CHILD] = p.value;
    return [...rows.values()].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  }, [chart]);

  const series = [
    ...chart.lines.map((l) => ({
      name: l.label,
      color: lineColor(l.label),
      strokeDasharray: l.label === "Median" || l.label === "50th" ? undefined : "4 4",
    })),
    { name: CHILD, color: "primary.6" },
  ];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {chart.standard}. {chart.x_label} against {chart.unit}.
      </Text>
      <LineChart
        h={340}
        data={data}
        dataKey="x"
        series={series}
        curveType="linear"
        connectNulls
        withLegend
        withDots={false}
        strokeWidth={1.5}
        xAxisLabel={chart.x_label}
        yAxisLabel={chart.unit}
        xAxisProps={{ type: "number", domain: ["dataMin", "dataMax"] }}
        yAxisProps={{ domain: ["dataMin", "dataMax"] }}
        lineProps={(s) => (s.name === CHILD ? { dot: { r: 4 }, strokeWidth: 2 } : {})}
      />
      {chart.points.length === 0 ? (
        <Text size="sm">No measurement in this age range has been charted yet.</Text>
      ) : (
        <Table aria-label={`${chart.title} measurements`}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Measured</Table.Th>
              <Table.Th>Age</Table.Th>
              <Table.Th>Value</Table.Th>
              <Table.Th>z-score</Table.Th>
              <Table.Th>Centile</Table.Th>
              <Table.Th>Flags</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {chart.points.map((p) => (
              <Table.Tr key={`${p.measured_on}-${p.x}-${p.value}`}>
                <Table.Td>{p.measured_on}</Table.Td>
                <Table.Td>
                  {ageText(p.age_days)}
                  {p.corrected ? " (corrected)" : ""}
                </Table.Td>
                <Table.Td>
                  {p.value.toFixed(1)} {chart.unit}
                </Table.Td>
                <Table.Td>
                  {p.z > 0 ? "+" : ""}
                  {p.z.toFixed(2)}
                  {p.extrapolated ? " (extrapolated)" : ""}
                </Table.Td>
                <Table.Td>{p.percentile.toFixed(1)}</Table.Td>
                <Table.Td>
                  {p.flags.map((f) => (
                    <Badge key={f.code} tone="warning" mr={4}>
                      {f.label}
                    </Badge>
                  ))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
