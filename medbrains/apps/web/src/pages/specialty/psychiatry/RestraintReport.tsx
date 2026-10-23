import { Group, Stack, Text } from "@mantine/core";
import type { RestraintReportRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Input } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { formatDateTime, labelOf, RESTRAINT_TYPES } from "./labels";

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const COLUMNS: Column<RestraintReportRow>[] = [
  {
    key: "patient",
    label: "Patient",
    render: (r) => <PatientNameCell patientId={r.patient_id} showUhid />,
  },
  {
    key: "type",
    label: "Type",
    render: (r) => <Text size="sm">{labelOf(RESTRAINT_TYPES, r.restraint_type)}</Text>,
  },
  { key: "method", label: "Method", render: (r) => <Text size="sm">{r.method ?? "—"}</Text> },
  { key: "reason", label: "Justification", render: (r) => <Text size="sm">{r.reason}</Text> },
  {
    key: "from",
    label: "Started",
    render: (r) => <Text size="sm">{formatDateTime(r.start_time)}</Text>,
  },
  { key: "to", label: "Ended", render: (r) => <Text size="sm">{formatDateTime(r.end_time)}</Text> },
  {
    key: "rep",
    label: "Representative told",
    render: (r) => <Text size="sm">{formatDateTime(r.nominated_rep_informed_at)}</Text>,
  },
];

/** s.97(7): every restraint in the month, for the report to the Board. */
export function RestraintReport() {
  const [month, setMonth] = useState(thisMonth());
  const query = useQuery({
    queryKey: ["psych-restraint-report", month],
    queryFn: () => psychiatryService.restraintReport(`${month}-01`),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  return (
    <Stack gap="sm">
      <Group align="flex-end">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.currentTarget.value)}
        />
        <Text size="sm" c="dimmed">
          {query.data ? `${query.data.length} episode(s)` : ""}
        </Text>
      </Group>
      <DataTable
        columns={COLUMNS}
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No restraint this month"
        exportable
        exportFileName={`restraint-report-${month}`}
      />
    </Stack>
  );
}
