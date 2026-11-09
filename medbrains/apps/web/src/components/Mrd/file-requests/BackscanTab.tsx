import { Stack, Text } from "@mantine/core";
import type { MrdBackscanItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { mrdService } from "@/services/mrd.service";

/** The planning window the order is drawn from. */
const WINDOW_DAYS = 7;

const COLUMNS: Column<MrdBackscanItem>[] = [
  {
    key: "next_visit_at",
    label: "Next visit",
    render: (r) => <Text size="sm">{new Date(r.next_visit_at).toLocaleString()}</Text>,
  },
  { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name}</Text> },
  {
    key: "record_number",
    label: "File",
    render: (r) => (
      <Text size="sm" ff="monospace">
        {r.uhid} · {r.record_number}
      </Text>
    ),
  },
  {
    key: "location_label",
    label: "Shelf",
    render: (r) => <Text size="sm">{r.location_label ?? "Not recorded"}</Text>,
  },
  {
    key: "upcoming_visits",
    label: "Visits booked",
    render: (r) => <Text size="sm">{r.upcoming_visits}</Text>,
  },
];

/**
 * What to scan first: patients booked in the next week whose paper file has
 * never been scanned, soonest visit first. Each one scanned is a file nobody
 * has to fetch next time.
 */
export function BackscanTab() {
  const order = useQuery({
    queryKey: ["mrd-backscan", WINDOW_DAYS],
    queryFn: () => mrdService.listMrdBackscanOrder(WINDOW_DAYS),
  });
  return (
    <Stack gap="sm">
      <Text size="sm">
        Paper files of patients coming in the next {WINDOW_DAYS} days that have not been scanned.
        Scan them in this order in the Digitise section.
      </Text>
      <DataTable
        columns={COLUMNS}
        data={order.data ?? []}
        loading={order.isLoading}
        error={order.error}
        onRetry={() => void order.refetch()}
        rowKey={(r) => r.medical_record_id}
        emptyTitle="Every booked patient's file is scanned"
      />
    </Stack>
  );
}
