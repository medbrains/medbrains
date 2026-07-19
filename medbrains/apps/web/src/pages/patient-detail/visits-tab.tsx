// PATIENT VisitsTab — split from patient-detail.tsx (pure move).

import { Text } from "@mantine/core";
import type { PatientVisitRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import type { Column } from "@/components/DataTable";
import { DataTable } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { formatDate } from "./shared";

const STATUS_COLORS: Record<string, BadgeTone> = {
  open: "primary",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

const VISIT_COLUMNS: Column<PatientVisitRow>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    sortValue: (v) => v.encounter_date,
    render: (v) => (
      <Text size="sm" fw={500}>
        {formatDate(v.encounter_date)}
      </Text>
    ),
  },
  {
    key: "type",
    label: "Type",
    render: (v) => (
      <Badge size="sm" tt="uppercase">
        {v.encounter_type}
      </Badge>
    ),
  },
  { key: "doctor", label: "Doctor", render: (v) => <Text size="sm">{v.doctor_name ?? "-"}</Text> },
  {
    key: "department",
    label: "Department",
    render: (v) => <Text size="sm">{v.department_name ?? "-"}</Text>,
  },
  {
    key: "chief",
    label: "Chief Complaint",
    render: (v) => (
      <Text size="sm" lineClamp={1}>
        {v.chief_complaint ?? "-"}
      </Text>
    ),
  },
  {
    key: "dx",
    label: "Dx",
    render: (v) => (
      <Text size="sm" ta="center">
        {v.diagnosis_count ?? 0}
      </Text>
    ),
  },
  {
    key: "rx",
    label: "Rx",
    render: (v) => (
      <Text size="sm" ta="center">
        {v.prescription_count ?? 0}
      </Text>
    ),
  },
  {
    key: "lab",
    label: "Lab",
    render: (v) => (
      <Text size="sm" ta="center">
        {v.lab_order_count ?? 0}
      </Text>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (v) => (
      <Badge tone={STATUS_COLORS[v.status] ?? "neutral"} size="sm">
        {v.status.replace(/_/g, " ")}
      </Badge>
    ),
  },
];

export function VisitsTab({ patientId }: { patientId: string }) {
  const { data: visits, isLoading } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => patientDetailService.listPatientVisits(patientId),
  });

  return (
    <DataTable
      columns={VISIT_COLUMNS}
      data={visits ?? []}
      loading={isLoading}
      rowKey={(v) => v.id}
      emptyTitle="No visit history found."
    />
  );
}

// ── Prescriptions Tab ────────────────────────────────────────
