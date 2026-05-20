// NABH KPI dashboard: official 2025 KPI catalog with live values and
// pending source-data gaps.
import { Badge, Card, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import type { NabhIndicator } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { reportsService } from "../../services/reports.service";

const CATEGORY_LABELS: Record<string, { label: string; tone: string }> = {
  access: { label: "Access & flow", tone: "primary" },
  clinical: { label: "Clinical", tone: "teal" },
  safety: { label: "Patient safety", tone: "danger" },
  experience: { label: "Patient experience", tone: "violet" },
  operations: { label: "Operations", tone: "slate" },
};

function formatValue(v: number | null | undefined, unit: string): string {
  if (v == null) return "—";
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "minutes") return `${v.toFixed(0)} min`;
  if (unit === "hours") return `${v.toFixed(1)} h`;
  if (unit === "days") return `${v.toFixed(1)} d`;
  return v.toFixed(2);
}

function trafficLight(ind: NabhIndicator): "green" | "amber" | "red" | "gray" {
  if (ind.value_current_month == null || ind.target == null) return "gray";
  const v = ind.value_current_month;
  const t = ind.target;
  if (ind.direction === "lower_better") {
    if (v <= t) return "green";
    if (v <= t * 1.25) return "amber";
    return "red";
  }
  if (v >= t) return "green";
  if (v >= t * 0.85) return "amber";
  return "red";
}

const TRAFFIC_COLOUR = {
  green: "var(--mantine-color-success-6, #2f9e44)",
  amber: "var(--mantine-color-orange-6, #e8590c)",
  red: "var(--mantine-color-danger-6, #c8102e)",
  gray: "var(--mantine-color-gray-5, #adb5bd)",
} as const;

function delta(
  curr: number | null,
  prev: number | null,
  direction: NabhIndicator["direction"],
): string {
  if (curr == null || prev == null || prev === 0) return "";
  const diff = curr - prev;
  const pct = (diff / prev) * 100;
  const better = direction === "lower_better" ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "·";
  const sign = better ? "improving" : diff === 0 ? "flat" : "worsening";
  return `${arrow} ${Math.abs(pct).toFixed(1)}% MoM (${sign})`;
}

function IndicatorTile({ ind }: { ind: NabhIndicator }) {
  const light = trafficLight(ind);
  return (
    <Card withBorder padding="md" radius="md" style={{ minWidth: 240, flex: 1 }}>
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} ff="monospace">
            {ind.code}
          </Text>
          <Tooltip label={`Light: ${light}`} withArrow>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: TRAFFIC_COLOUR[light],
                display: "inline-block",
              }}
            />
          </Tooltip>
        </Group>
        <Text fw={600} size="sm">
          {ind.label}
        </Text>
        <Text
          fw={700}
          size="xl"
          style={{ fontFamily: "var(--mantine-font-family-fraunces, serif)" }}
        >
          {formatValue(ind.value_current_month, ind.unit)}
        </Text>
        {ind.target != null && (
          <Text size="xs" c="dimmed">
            Target: {formatValue(ind.target, ind.unit)} (
            {ind.direction === "lower_better" ? "lower is better" : "higher is better"})
          </Text>
        )}
        {ind.value_prev_month != null && (
          <Text size="xs" c="dimmed">
            {delta(ind.value_current_month, ind.value_prev_month, ind.direction)}
          </Text>
        )}
        {ind.denominator_label && (
          <Text size="xs" c="dimmed">
            {ind.denominator_label}
          </Text>
        )}
        {ind.note && (
          <Text size="xs" c="dimmed">
            {ind.note}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export default function NabhIndicatorsPage() {
  useRequirePermission(P.QUALITY.INDICATORS_LIST);

  const { data, isLoading } = useQuery({
    queryKey: ["nabh-indicators"],
    queryFn: () => reportsService.getNabhIndicators(),
  });

  const grouped = (data?.indicators ?? []).reduce<Record<string, NabhIndicator[]>>((acc, ind) => {
    const bucket = acc[ind.category] ?? [];
    bucket.push(ind);
    acc[ind.category] = bucket;
    return acc;
  }, {});

  return (
    <Stack gap="md">
      <PageHeader
        title="NABH quality indicators"
        subtitle={
          data
            ? `${data.period_label} · ${data.coverage.computed} live of ${data.coverage.total_indicators} total`
            : "Loading"
        }
      />

      {data && (
        <Card withBorder padding="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600}>Coverage</Text>
              <Text size="xs" c="dimmed">
                {data.coverage.note}
              </Text>
            </Stack>
            <Group gap="xs">
              <Badge color="success" size="lg" variant="light">
                {data.coverage.computed} live
              </Badge>
              <Badge color="orange" size="lg" variant="light">
                {data.coverage.total_indicators - data.coverage.computed} pending
              </Badge>
            </Group>
          </Group>
        </Card>
      )}

      {isLoading && <Text c="dimmed">Aggregating from across the system…</Text>}

      {Object.entries(grouped).map(([cat, items]) => {
        const meta = CATEGORY_LABELS[cat] ?? { label: cat, tone: "slate" };
        return (
          <Stack key={cat} gap="xs">
            <Title order={4}>{meta.label}</Title>
            <Group align="stretch" gap="md" wrap="wrap">
              {items.map((ind) => (
                <IndicatorTile key={ind.code} ind={ind} />
              ))}
            </Group>
          </Stack>
        );
      })}
    </Stack>
  );
}
