import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from "@tabler/icons-react";
import { seriesStats } from "./series-stats";

interface SeriesMetricsProps {
  values: (number | null)[];
  /** How a figure prints; plain grouped numbers by default. */
  format?: (n: number) => string;
  /** The tile's strip: latest, change and average only. */
  compact?: boolean;
}

const plain = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);

/**
 * The figures under a line, ticker style: latest, the move from the point
 * before it, and the range. Neutral on purpose — a generic chart does not
 * know whether up is good, so the arrow and the words carry the direction
 * and no colour claims a verdict.
 */
export function SeriesMetrics({ values, format = plain, compact = false }: SeriesMetricsProps) {
  const s = seriesStats(values);
  if (s.count === 0) return null;
  const show = (n: number | null) => (n === null ? "—" : format(n));
  const cells: [string, string][] = [
    ["Latest", show(s.latest)],
    ["Average", show(s.average)],
    ...(compact
      ? []
      : ([
          ["Low", show(s.min)],
          ["High", show(s.max)],
          ["Total", show(s.total)],
        ] as [string, string][])),
  ];
  return (
    <Group gap="lg" wrap="wrap" align="flex-start">
      <SimpleGrid cols={{ base: 2, xs: compact ? 2 : 5 }} spacing="md" verticalSpacing={4}>
        {cells.map(([label, value]) => (
          <Stack key={label} gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase">
              {label}
            </Text>
            <Text fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
              {value}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
      <Change change={s.change} pct={s.changePct} format={format} />
    </Group>
  );
}

function Change({
  change,
  pct,
  format,
}: {
  change: number | null;
  pct: number | null;
  format: (n: number) => string;
}) {
  if (change === null) return null;
  const Icon = change > 0 ? IconArrowUpRight : change < 0 ? IconArrowDownRight : IconMinus;
  const words =
    change === 0
      ? "No change from the point before"
      : `${change > 0 ? "Up" : "Down"} ${format(Math.abs(change))}${
          pct === null ? "" : ` (${Math.abs(pct).toFixed(1)}%)`
        } from the point before`;
  return (
    <Group gap={4} wrap="nowrap">
      <Icon size={16} stroke={2} aria-hidden />
      <Text size="sm" fw={500}>
        {words}
      </Text>
    </Group>
  );
}
