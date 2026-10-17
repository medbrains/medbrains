/**
 * Eye OPD (#231): the exams recorded — a patient's own when opened from their
 * visit, the department's otherwise — each opening to its workup, signature
 * and spectacle prescription.
 */
import { Group, Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { OphthoExam } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, Button } from "@/components/ui";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";
import { ExamDrawer } from "./ophtho/ExamDrawer";

const pair = (od: string | null, os: string | null) => `${od ?? "—"} / ${os ?? "—"}`;

const COLUMNS: Column<OphthoExam>[] = [
  {
    key: "patient_id",
    label: "Patient",
    render: (row) => <PatientNameCell patientId={row.patient_id} />,
  },
  {
    key: "visual_acuity_od",
    label: "Vision R / L (unaided)",
    render: (row) => pair(row.visual_acuity_od, row.visual_acuity_os),
  },
  {
    key: "sphere_od",
    label: "Sphere R / L",
    render: (row) => pair(row.sphere_od, row.sphere_os),
  },
  {
    key: "iop_od",
    label: "IOP R / L",
    render: (row) => pair(row.iop_od, row.iop_os),
  },
  { key: "diagnosis", label: "Diagnosis", render: (row) => row.diagnosis ?? "—" },
  {
    key: "signed_at",
    label: "Prescription",
    render: (row) =>
      row.signed_at ? <Badge tone="success">Signed</Badge> : <Badge tone="neutral">Draft</Badge>,
  },
  {
    key: "created_at",
    label: "Date",
    render: (row) => new Date(row.created_at).toLocaleDateString(),
  },
];

export function OphthoPage() {
  useRequirePermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_CREATE);
  const navigate = useNavigate();
  const scope = usePatientScope();
  const [target, setTarget] = useState<OphthoExam | "new" | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["ophtho-exams", scope.patientId],
    queryFn: () =>
      specialtyService.listOphthoExams(
        scope.patientId ? { patient_id: scope.patientId } : undefined,
      ),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Ophthalmology"
        subtitle="Eye exams — vision, refraction, IOP, findings and the spectacle prescription"
        actions={
          <Group gap="sm">
            {scope.returnPath && (
              <Button
                tone="secondary"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(scope.returnPath ?? "/dashboard")}
              >
                Back to visit
              </Button>
            )}
            {canCreate && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => setTarget("new")}>
                New exam
              </Button>
            )}
          </Group>
        }
      />

      <DataTable
        columns={COLUMNS}
        data={exams}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(row) => setTarget(row)}
        emptyTitle={scope.isScoped ? "No eye exams for this patient yet." : "No eye exams yet."}
      />

      <ExamDrawer
        target={target}
        scope={scope}
        onClose={() => setTarget(null)}
        onSaved={(exam) => setTarget(exam)}
      />
    </Stack>
  );
}
