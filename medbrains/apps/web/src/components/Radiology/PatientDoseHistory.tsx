/**
 * The patient's radiation dose in the chart: the cumulative CT estimate and
 * every exam's recorded dose, newest first. Gated on reading imaging orders,
 * like the query it makes; a failed load is shown, never an empty history.
 */
import { Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PatientDoseRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { QueryError } from "@/components/QueryError";
import { Badge } from "@/components/ui";
import { DOSE_SOURCE_LABEL, doseFigures } from "@/lib/radiation-dose";
import { radiologyService } from "@/services/radiology.service";
import { CumulativeDoseNotice } from "./CumulativeDoseNotice";

const NOT_ESTIMATED = {
  region_unknown: "Not estimated — body region not recognised",
  age_unknown: "Not estimated — date of birth not on record",
} as const;

function estimateText(d: PatientDoseRecord): string {
  if (d.estimated_msv !== null) return `≈ ${d.estimated_msv.toFixed(2)} mSv (${d.region})`;
  if (d.not_estimated) return NOT_ESTIMATED[d.not_estimated];
  return d.dap !== null ? "DAP not converted" : "—";
}

interface PatientDoseHistoryProps {
  patientId: string;
}

export function PatientDoseHistory({ patientId }: PatientDoseHistoryProps) {
  const canView = useHasPermission(P.RADIOLOGY.ORDERS_VIEW);
  const history = useQuery({
    queryKey: ["patient-dose-records", patientId],
    queryFn: () => radiologyService.listPatientDoseRecords(patientId),
    enabled: canView,
  });
  if (!canView) return null;
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Radiation dose
      </Text>
      <CumulativeDoseNotice patientId={patientId} />
      {history.isLoading ? (
        <Loader size="sm" />
      ) : history.isError ? (
        <QueryError error={history.error} onRetry={() => void history.refetch()} />
      ) : (history.data ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          No radiation dose recorded.
        </Text>
      ) : (
        <DataTable
          columns={[
            {
              key: "when",
              label: "Date",
              render: (d: PatientDoseRecord) => new Date(d.recorded_at).toLocaleDateString(),
            },
            {
              key: "exam",
              label: "Exam",
              render: (d: PatientDoseRecord) => d.exam ?? d.modality_code,
            },
            {
              key: "figures",
              label: "Dose",
              render: (d: PatientDoseRecord) => doseFigures(d).join(" · ") || "—",
            },
            {
              key: "estimate",
              label: "Estimated effective dose",
              render: (d: PatientDoseRecord) => estimateText(d),
            },
            {
              key: "source",
              label: "From",
              render: (d: PatientDoseRecord) => (
                <Badge size="sm" tone={d.source === "manual" ? "neutral" : "info"}>
                  {DOSE_SOURCE_LABEL[d.source]}
                </Badge>
              ),
            },
          ]}
          data={history.data ?? []}
          rowKey={(d) => d.id}
        />
      )}
    </Stack>
  );
}
