// NABH KPI dashboard: official 2025 KPI catalog with live values and
// pending source-data gaps.
import {
  Box,
  Card,
  Grid,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { NabhIndicator } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconChartBar, IconSearch, IconSettings, IconShieldCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { reportsService } from "@/services/reports.service";
import classes from "./nabh-indicators.module.scss";

const CATEGORY_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  access: { label: "Access & flow", tone: "primary" },
  clinical: { label: "Clinical", tone: "success" },
  safety: { label: "Patient safety", tone: "danger" },
  experience: { label: "Patient experience", tone: "accent" },
  operations: { label: "Operations", tone: "neutral" },
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
            <Box
              component="span"
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
  const canViewReports = useHasPermission(P.ANALYTICS.VIEW);
  const canOpenSettings = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["nabh-indicators"],
    queryFn: () => reportsService.getNabhIndicators(),
  });

  const categoryOptions = useMemo(() => {
    const categories = new Set((data?.indicators ?? []).map((indicator) => indicator.category));
    return [
      { value: "all", label: "All categories" },
      ...[...categories].sort().map((category) => ({
        value: category,
        label: CATEGORY_LABELS[category]?.label ?? category,
      })),
    ];
  }, [data?.indicators]);
  const filteredIndicators = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (data?.indicators ?? []).filter((indicator) => {
      if (categoryFilter !== "all" && indicator.category !== categoryFilter) return false;
      if (!normalizedSearch) return true;
      return [
        indicator.code,
        indicator.label,
        indicator.category,
        indicator.denominator_label,
        indicator.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [categoryFilter, data?.indicators, search]);
  const grouped = useMemo(
    () =>
      filteredIndicators.reduce<Record<string, NabhIndicator[]>>((acc, ind) => {
        const bucket = acc[ind.category] ?? [];
        bucket.push(ind);
        acc[ind.category] = bucket;
        return acc;
      }, {}),
    [filteredIndicators],
  );
  const pendingCount = data ? data.coverage.total_indicators - data.coverage.computed : 0;

  return (
    <Stack gap="md" className={classes.indicatorWorkspace}>
      <PageHeader
        title="NABH quality indicators"
        subtitle={
          data
            ? `${data.period_label} · ${data.coverage.computed} live of ${data.coverage.total_indicators} total`
            : "Loading"
        }
      />

      <Card withBorder className={classes.commandBar}>
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Indicator evidence workspace
            </Text>
            <Group gap="xs">
              <Badge tone="success">{data?.coverage.computed ?? 0} live</Badge>
              <Badge tone="warning">{pendingCount} pending</Badge>
              <Badge tone="info">{filteredIndicators.length} visible</Badge>
            </Group>
          </Stack>
          <Group gap="xs" className={classes.commandControls}>
            <TextInput
              placeholder="Search code, label, denominator, note..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              size="sm"
              className={classes.searchInput}
            />
            <Select
              aria-label="Indicator category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value ?? "all")}
              allowDeselect={false}
              size="sm"
              className={classes.categorySelect}
            />
            {canViewReports && (
              <Button
                tone="secondary"
                component="a"
                href="/reports"
                size="sm"
                leftSection={<IconChartBar size={16} />}
              >
                Reports
              </Button>
            )}
            {canOpenSettings && (
              <Button
                tone="secondary"
                component="a"
                href="/admin/settings#master-data"
                size="sm"
                leftSection={<IconSettings size={16} />}
              >
                Settings
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {isLoading && <Text c="dimmed">Aggregating from across the system…</Text>}

      <Grid align="flex-start" className={classes.indicatorGrid}>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            {Object.entries(grouped).map(([cat, items]) => {
              const meta = CATEGORY_LABELS[cat] ?? { label: cat, tone: "neutral" };
              return (
                <Stack key={cat} gap="xs">
                  <Group justify="space-between">
                    <Title order={4}>{meta.label}</Title>
                    <Badge tone={meta.tone}>{items.length}</Badge>
                  </Group>
                  <Group align="stretch" gap="md" wrap="wrap">
                    {items.map((ind) => (
                      <IndicatorTile key={ind.code} ind={ind} />
                    ))}
                  </Group>
                </Stack>
              );
            })}
            {!isLoading && filteredIndicators.length === 0 && (
              <Card withBorder padding="lg">
                <Text c="dimmed">No indicators match this search/filter.</Text>
              </Card>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder className={classes.evidenceRail}>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Coverage
                </Text>
                <Text size="sm" fw={700}>
                  {data?.period_label ?? "Loading period"}
                </Text>
                <Text size="xs" c="dimmed">
                  {data?.coverage.note ?? "Waiting for indicator coverage data."}
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge tone="success" size="lg">
                  {data?.coverage.computed ?? 0} live
                </Badge>
                <Badge tone="warning" size="lg">
                  {pendingCount} pending
                </Badge>
                <Badge tone="neutral" size="lg">
                  {data?.coverage.total_indicators ?? 0} total
                </Badge>
              </Group>
              <Card withBorder padding="sm" radius="sm">
                <Group align="flex-start" gap="xs" wrap="nowrap">
                  <IconShieldCheck size={16} />
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      Evidence loop
                    </Text>
                    <Text size="xs" c="dimmed">
                      Pending indicators should route back to settings masters, event capture, and
                      report sources instead of staying as dashboard-only gaps.
                    </Text>
                  </Stack>
                </Group>
              </Card>
              {canViewReports && (
                <Button
                  tone="secondary"
                  component="a"
                  href="/reports"
                  leftSection={<IconChartBar size={16} />}
                  fullWidth
                >
                  Open report catalog
                </Button>
              )}
              {canOpenSettings && (
                <Button
                  tone="secondary"
                  component="a"
                  href="/admin/settings#master-data"
                  leftSection={<IconSettings size={16} />}
                  fullWidth
                >
                  Open settings readiness
                </Button>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
