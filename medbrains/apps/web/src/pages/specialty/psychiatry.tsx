import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychPatient } from "@medbrains/types";
import { IconLock, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, Button } from "@/components/ui";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { psychiatryService } from "@/services/psychiatry.service";
import { admissionCategoryLabel } from "./psychiatry/labels";
import { PsychRecordPanel } from "./psychiatry/PsychRecordPanel";
import { RegisterPsychPatientModal } from "./psychiatry/RegisterPsychPatientModal";

export function PsychiatryPage() {
  useRequirePermission(P.SPECIALTY.PSYCHIATRY.PATIENTS_LIST);
  // Opened from a patient's encounter: start on their record, and start the
  // registration form on them, rather than making the clinician find them.
  const { patientId: scopedPatientId } = usePatientScope();
  const canCreate = useHasPermission(P.SPECIALTY.PSYCHIATRY.PATIENTS_CREATE);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The server returns only the records this user may open: restricted ones
  // reach the treating psychiatrist, authorised roles and break-glass only.
  const patients = useQuery({
    queryKey: ["psych-patients"],
    queryFn: () => psychiatryService.listPatients(),
  });
  const rows = patients.data ?? [];
  const selected = useMemo(() => {
    const id = selectedId ?? rows.find((r) => r.patient_id === scopedPatientId)?.id ?? null;
    return rows.find((r) => r.id === id) ?? null;
  }, [rows, selectedId, scopedPatientId]);

  const columns: Column<PsychPatient>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "category",
      label: "Admission category",
      render: (r) => <Badge tone="neutral">{admissionCategoryLabel(r.admission_category)}</Badge>,
    },
    {
      key: "restricted",
      label: "Access",
      render: (r) =>
        r.is_restricted ? (
          <Group gap={4} wrap="nowrap">
            <IconLock size={16} aria-hidden />
            <Text size="sm">Restricted</Text>
          </Group>
        ) : (
          <Text size="sm">Care team</Text>
        ),
    },
    {
      key: "substance",
      label: "Substance use",
      render: (r) =>
        r.substance_abuse_flag ? <Badge tone="warning">Yes</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "nominated",
      label: "Nominated representative",
      render: (r) => <Text size="sm">{r.nominated_rep_name ?? "None named"}</Text>,
    },
    {
      key: "open",
      label: "",
      render: (r) => (
        <Button tone="tertiary" size="xs" onClick={() => setSelectedId(r.id)}>
          Open record
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Psychiatry"
        subtitle="Mental Healthcare Act 2017 — admissions, assessments, ECT, restraint and Review Board notices"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={() => setRegisterOpen(true)}
            >
              Register patient
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        loading={patients.isLoading}
        error={patients.error ?? undefined}
        onRetry={() => void patients.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No psychiatric records you can open"
        emptyDescription="Restricted records appear only to their treating psychiatrist and to people your hospital has authorised."
      />
      {selected && <PsychRecordPanel key={selected.id} record={selected} />}
      {canCreate && (
        <RegisterPsychPatientModal
          opened={registerOpen}
          onClose={() => setRegisterOpen(false)}
          initialPatientId={scopedPatientId}
          onRegistered={(row) => setSelectedId(row.id)}
        />
      )}
    </Stack>
  );
}
