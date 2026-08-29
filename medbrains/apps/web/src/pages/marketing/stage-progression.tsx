import { Group, Stack, Text } from "@mantine/core";
import type { MarketingFunnelStageRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, Card } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * Seconds as something a person reads at a glance.
 *
 * Deliberately coarse. The administrator is asking "is this getting slower",
 * and "1.8 days" answers that where "43h 12m" makes them do arithmetic first.
 */
function humaniseDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

/**
 * Where enquiries are, and how long they take to move.
 *
 * The conversion percentages next door answer "did the spend work". This
 * answers the question that actually has an action attached: the leak is
 * between two named stages, and a percentage does not show you that a stage
 * is slowing down until it has already cost a month of bookings.
 *
 * Median rather than mean throughout — one enquiry left open for nine months
 * because somebody forgot to close it drags a mean past every real number in
 * the column, and a statistic a single stale row can move is not evidence.
 */
export function StageProgression() {
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "reports", "funnel"],
    queryFn: () => marketingService.funnel(),
  });

  // The slowest stage that anything has actually left. A stage nothing has
  // left has no median, and "no data yet" is not "instant".
  const slowest = useMemo(() => {
    const measured = rows.filter(
      (r): r is MarketingFunnelStageRow & { median_seconds: number } =>
        r.median_seconds !== null && !r.is_won && !r.is_lost,
    );
    if (measured.length === 0) return null;
    return measured.reduce((a, b) => (b.median_seconds > a.median_seconds ? b : a));
  }, [rows]);

  const waiting = useMemo(
    () => rows.filter((r) => !r.is_won && !r.is_lost).reduce((n, r) => n + r.currently_in, 0),
    [rows],
  );

  const columns = [
    {
      key: "stage_name",
      label: "Stage",
      render: (row: MarketingFunnelStageRow) => (
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{row.stage_name}</Text>
          {row.is_won && (
            <Badge tone="success" size="sm">
              Converted
            </Badge>
          )}
          {row.is_lost && (
            <Badge tone="neutral" size="sm">
              Closed
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "currently_in",
      label: "Waiting here now",
      render: (row: MarketingFunnelStageRow) => (
        <Text size="sm" fw={row.currently_in > 0 ? 600 : 400}>
          {row.currently_in}
        </Text>
      ),
    },
    {
      key: "entered",
      label: "Entered",
      render: (row: MarketingFunnelStageRow) => <Text size="sm">{row.entered}</Text>,
    },
    {
      key: "exited",
      label: "Moved on",
      render: (row: MarketingFunnelStageRow) => <Text size="sm">{row.exited}</Text>,
    },
    {
      key: "median_seconds",
      label: "Median time here",
      render: (row: MarketingFunnelStageRow) =>
        row.median_seconds === null ? (
          // Not "0" and not "—" alone: the reason matters, because a stage
          // nothing has left yet looks identical to an instant one otherwise.
          <Text size="sm" c="dimmed">
            Nothing has left yet
          </Text>
        ) : (
          <Text size="sm" fw={row.stage_id === slowest?.stage_id ? 600 : 400}>
            {humaniseDuration(row.median_seconds)}
          </Text>
        ),
    },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              Stage progression
            </Text>
            <Text size="xs" c="dimmed">
              Median measured over enquiries that have left the stage. Enquiries still sitting in
              one are counted under "waiting here now" and excluded from the median — they have not
              finished waiting yet.
            </Text>
          </Stack>
          {slowest && (
            <Badge tone="warning">
              Slowest: {slowest.stage_name} · {humaniseDuration(slowest.median_seconds)}
            </Badge>
          )}
        </Group>

        {waiting > 0 && (
          <Text size="sm">
            <Text span fw={700}>
              {waiting}
            </Text>{" "}
            {waiting === 1 ? "enquiry is" : "enquiries are"} waiting somewhere in the funnel.
          </Text>
        )}

        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          rowKey={(row: MarketingFunnelStageRow) => row.stage_id}
          emptyTitle={isError ? "Stage progression could not be loaded" : "No stage history yet"}
          emptyDescription={
            isError
              ? "This is not a statement that no enquiries are waiting — the report failed to load."
              : "Move an enquiry between stages and the time it spends in each will be measured here."
          }
        />
      </Stack>
    </Card>
  );
}
