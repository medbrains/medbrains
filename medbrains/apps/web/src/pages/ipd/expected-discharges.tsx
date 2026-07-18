// IPD ExpectedDischargesTab — split from ipd.tsx (pure move).

import { Group, NumberInput, Stack, Text } from "@mantine/core";
import type { ExpectedDischargeRow } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Column } from "@/components";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function ExpectedDischargesTab() {
  const [hours, setHours] = useState<number | string>(48);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expected-discharges", hours],
    queryFn: () => ipdService.expectedDischarges({ hours: typeof hours === "number" ? hours : 48 }),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (row: ExpectedDischargeRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: ExpectedDischargeRow) => (
        <Text size="sm" fw={500}>
          {row.patient_name}
        </Text>
      ),
    },
    {
      key: "ward",
      label: "Ward",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.ward}</Text>,
    },
    {
      key: "bed_number",
      label: "Bed",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.bed_number}</Text>,
    },
    {
      key: "expected_discharge_date",
      label: "Expected Discharge",
      render: (row: ExpectedDischargeRow) => (
        <Text size="sm">{new Date(row.expected_discharge_date).toLocaleString()}</Text>
      ),
    },
    {
      key: "attending_doctor",
      label: "Attending Doctor",
      render: (row: ExpectedDischargeRow) => <Text size="sm">{row.attending_doctor}</Text>,
    },
    {
      key: "days_admitted",
      label: "Days Admitted",
      render: (row: ExpectedDischargeRow) => (
        <Badge
          tone={row.days_admitted > 14 ? "danger" : row.days_admitted > 7 ? "warning" : "primary"}
          size="sm"
        >
          {row.days_admitted} days
        </Badge>
      ),
    },
  ] satisfies Column<ExpectedDischargeRow>[];

  return (
    <Stack>
      <Group>
        <NumberInput
          label="Within next (hours)"
          value={hours}
          onChange={setHours}
          min={1}
          max={168}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => row.admission_id}
      />
      {!isLoading && rows.length === 0 && (
        <Text size="sm" c="dimmed" ta="center">
          No expected discharges within the next {typeof hours === "number" ? hours : 48} hours.
        </Text>
      )}
    </Stack>
  );
}
