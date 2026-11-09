import { Group, Stack, Text } from "@mantine/core";
import type { MrdDeliveryTimeRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Input } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const GROUP_LABEL: Record<MrdDeliveryTimeRow["grouping"], string> = {
  all: "Whole hospital",
  department: "OPD",
  runner: "Runner",
};

/** Minutes to one decimal, or a dash when there were no deliveries. */
export function minutes(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} min`;
}

/** `YYYY-MM-DD` for a date `daysAgo` before today, on this device's clock. */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const COLUMNS: Column<MrdDeliveryTimeRow>[] = [
  {
    key: "grouping",
    label: "For",
    render: (r) => (
      <Text size="sm">
        {GROUP_LABEL[r.grouping]}
        {r.grouping !== "all" && `: ${r.name ?? "Not recorded"}`}
      </Text>
    ),
  },
  { key: "deliveries", label: "Files", render: (r) => <Text size="sm">{r.deliveries}</Text> },
  {
    key: "median_minutes",
    label: "Median",
    render: (r) => <Text size="sm">{minutes(r.median_minutes)}</Text>,
  },
  {
    key: "p90_minutes",
    label: "Slowest 10% over",
    render: (r) => <Text size="sm">{minutes(r.p90_minutes)}</Text>,
  },
];

/**
 * How long patients wait for their paper file: registration to the file at
 * the clinic, median and 90th percentile, for the hospital, each OPD and
 * each runner. The same measure is on the management dashboard per day.
 */
export function FileWaitTab() {
  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const times = useQuery({
    queryKey: ["mrd-file-wait", from, to],
    queryFn: () => mrdService.getMrdFileDeliveryTimes(from, to),
    enabled: from.length === 10 && to.length === 10,
  });
  return (
    <Stack gap="sm">
      <Group wrap="wrap">
        <Input
          type="date"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
      </Group>
      <DataTable
        columns={COLUMNS}
        data={times.data ?? []}
        loading={times.isLoading}
        error={times.error}
        onRetry={() => void times.refetch()}
        rowKey={(r) => `${r.grouping}:${r.id ?? "all"}`}
        emptyTitle="No files delivered in this range"
      />
    </Stack>
  );
}
