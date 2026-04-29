import { Badge, Progress, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DischargeReadinessRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";
import { readinessColor } from "./shared";

export function DischargeTrackerTab({ wardId }: { wardId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "discharge-tracker", wardId],
    queryFn: () => api.dischargeReadiness(wardId ?? undefined),
    refetchInterval: 60_000,
  });

  const columns: Column<DischargeReadinessRow>[] = [
    { key: "patient_name", label: "Patient", render: (row) => <Text size="sm">{row.patient_name}</Text> },
    { key: "uhid", label: "UHID", render: (row) => <Text size="sm">{row.uhid}</Text> },
    { key: "bed_name", label: "Bed", render: (row) => <Text size="sm">{row.bed_name ?? "—"}</Text> },
    { key: "ward_name", label: "Ward", render: (row) => <Text size="sm">{row.ward_name ?? "—"}</Text> },
    {
      key: "expected_discharge_date",
      label: "Expected Discharge",
      render: (row) => (
        <Text size="sm">
          {row.expected_discharge_date ? new Date(row.expected_discharge_date).toLocaleDateString() : "—"}
        </Text>
      ),
    },
    {
      key: "readiness_pct",
      label: "Readiness",
      render: (row) => (
        <Stack gap={2}>
          <Progress value={row.readiness_pct} color={readinessColor(row.readiness_pct)} size="sm" />
          <Text size="xs" ta="center">
            {row.readiness_pct}%
          </Text>
        </Stack>
      ),
    },
    {
      key: "billing_cleared",
      label: "Billing",
      render: (row) => (
        <Badge size="xs" color={row.billing_cleared ? "success" : "slate"}>
          {row.billing_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "pharmacy_cleared",
      label: "Pharmacy",
      render: (row) => (
        <Badge size="xs" color={row.pharmacy_cleared ? "success" : "slate"}>
          {row.pharmacy_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "nursing_cleared",
      label: "Nursing",
      render: (row) => (
        <Badge size="xs" color={row.nursing_cleared ? "success" : "slate"}>
          {row.nursing_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "doctor_cleared",
      label: "Doctor",
      render: (row) => (
        <Badge size="xs" color={row.doctor_cleared ? "success" : "slate"}>
          {row.doctor_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "pending_lab_count",
      label: "Pending Labs",
      render: (row) => (
        <Text size="sm" c={row.pending_lab_count > 0 ? "danger" : undefined}>
          {row.pending_lab_count}
        </Text>
      ),
    },
  ];

  return <DataTable columns={columns} data={data ?? []} loading={isLoading} rowKey={(row) => row.admission_id} />;
}
