// Utilization-review LosMonitoringTab — split from utilization-review.tsx (pure move).

import { BarChart } from "@mantine/charts";
import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { LosComparisonRow, UrAnalyticsSummary, UtilizationReview } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { utilizationReviewService } from "@/services/utilizationReview.service";
import { reviewTypeColors, statusColorTone } from "./shared";

export function LosMonitoringTab() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["ur-analytics"],
    queryFn: () => utilizationReviewService.analyticsSummary(),
  });

  const { data: outliers = [], isLoading: outliersLoading } = useQuery({
    queryKey: ["ur-outliers"],
    queryFn: () => utilizationReviewService.listOutliers(),
  });

  const { data: losComparison = [], isLoading: losLoading } = useQuery({
    queryKey: ["ur-los-comparison"],
    queryFn: () => utilizationReviewService.losComparison(),
  });

  const outlierColumns: Column<UtilizationReview>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "review_type",
      label: "Review Type",
      render: (r) => (
        <Badge tone={reviewTypeColors[r.review_type] ?? "neutral"}>
          {r.review_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "decision",
      label: "Decision",
      render: (r) => (
        <Badge tone={statusColorTone(r.decision)}>{r.decision.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "expected_los_days",
      label: "Expected LOS",
      render: (r) => <Text size="sm">{r.expected_los_days ?? "—"}</Text>,
    },
    {
      key: "actual_los_days",
      label: "Actual LOS",
      render: (r) => <Text size="sm">{r.actual_los_days ?? "—"}</Text>,
    },
    {
      key: "review_date",
      label: "Review Date",
      render: (r) => <Text size="sm">{new Date(r.review_date).toLocaleDateString()}</Text>,
    },
  ];

  const losColumns: Column<LosComparisonRow>[] = [
    {
      key: "department_name",
      label: "Department",
      render: (r) => <Text size="sm">{r.department_name ?? "Unknown"}</Text>,
    },
    {
      key: "review_count",
      label: "Reviews",
      render: (r) => <Text size="sm">{r.review_count}</Text>,
    },
    {
      key: "avg_expected_los",
      label: "Avg Expected LOS",
      render: (r) => (
        <Text size="sm">{r.avg_expected_los != null ? r.avg_expected_los.toFixed(1) : "—"}</Text>
      ),
    },
    {
      key: "avg_actual_los",
      label: "Avg Actual LOS",
      render: (r) => (
        <Text size="sm">{r.avg_actual_los != null ? r.avg_actual_los.toFixed(1) : "—"}</Text>
      ),
    },
  ];

  const s: UrAnalyticsSummary = summary ?? {
    total_reviews: 0,
    avg_expected_los: undefined,
    avg_actual_los: undefined,
    outlier_count: 0,
    denial_count: 0,
    approval_rate: 0,
  };

  // Calculate denial analytics
  const denialData = useMemo(() => {
    if (!summary || !outliers) return null;
    const deniedReviews = outliers.filter((r) => r.decision === "denied");

    // Group denials by reason (use notes field)
    const reasonCounts: Record<string, number> = {};
    deniedReviews.forEach((r) => {
      const reason = r.notes || "No reason specified";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const denialReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate overturn rate (for now, use dummy data)
    const overturnRate = deniedReviews.length > 0 ? 15 : 0;
    const denialRate = s.total_reviews > 0 ? (s.denial_count / s.total_reviews) * 100 : 0;

    return {
      totalDenials: s.denial_count,
      denialRate,
      overturnRate,
      topReasons: denialReasons,
    };
  }, [summary, outliers, s]);

  return (
    <Stack gap="md">
      <PageHeader title="LOS Monitoring" subtitle="Length of stay analytics and outlier tracking" />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Total Reviews
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.total_reviews}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Avg Expected LOS
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading
              ? "..."
              : s.avg_expected_los != null
                ? s.avg_expected_los.toFixed(1)
                : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Avg Actual LOS
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.avg_actual_los != null ? s.avg_actual_los.toFixed(1) : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Outlier Count
          </Text>
          <Text fw={700} size="xl" c="danger">
            {summaryLoading ? "..." : s.outlier_count}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Denial Count
          </Text>
          <Text fw={700} size="xl" c="orange">
            {summaryLoading ? "..." : s.denial_count}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Approval Rate
          </Text>
          <Text fw={700} size="xl" c="success">
            {summaryLoading ? "..." : `${s.approval_rate.toFixed(1)}%`}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Denial Management Dashboard */}
      {denialData && denialData.totalDenials > 0 && (
        <Card withBorder p="md">
          <Group justify="space-between" mb="md">
            <Text fw={600} size="lg">
              Denial Management
            </Text>
            <Badge tone="danger" size="lg">
              {denialData.totalDenials} Denials
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder p="sm" bg="red.0">
              <Text size="xs" c="dimmed">
                Denial Rate
              </Text>
              <Text fw={700} size="lg" c="danger">
                {denialData.denialRate.toFixed(1)}%
              </Text>
            </Card>
            <Card withBorder p="sm" bg="green.0">
              <Text size="xs" c="dimmed">
                Overturn Rate
              </Text>
              <Text fw={700} size="lg" c="success">
                {denialData.overturnRate}%
              </Text>
            </Card>
            <Card withBorder p="sm" bg="orange.0">
              <Text size="xs" c="dimmed">
                Pending Appeals
              </Text>
              <Text fw={700} size="lg" c="orange">
                —
              </Text>
            </Card>
          </SimpleGrid>
          {denialData.topReasons.length > 0 && (
            <>
              <Text fw={600} size="sm" mb="xs">
                Top Denial Reasons
              </Text>
              <BarChart
                h={200}
                data={denialData.topReasons}
                dataKey="reason"
                series={[{ name: "count", color: "danger" }]}
                tickLine="y"
              />
            </>
          )}
        </Card>
      )}

      <Text fw={600} size="lg" mt="sm">
        Outlier Reviews
      </Text>
      <DataTable<UtilizationReview>
        data={outliers}
        loading={outliersLoading}
        rowKey={(r) => r.id}
        columns={outlierColumns}
      />

      <Text fw={600} size="lg" mt="sm">
        LOS by Department
      </Text>
      <DataTable<LosComparisonRow>
        data={losComparison}
        loading={losLoading}
        rowKey={(r) => r.department_name ?? "unknown"}
        columns={losColumns}
      />
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 3 — Payer Log
// ═══════════════════════════════════════════════════════
