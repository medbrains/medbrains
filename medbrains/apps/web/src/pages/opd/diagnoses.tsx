// OPD DiagnosesTab — split from opd.tsx (pure move).

import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDiagnosisRequest,
  Diagnosis,
  PatientDiagnosisRow,
  UpdateDiagnosisRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DiagnosisPanel } from "@/components";
import { opdService } from "@/services/opd.service";

export function DiagnosesTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const queryClient = useQueryClient();

  const { data: diagnoses = [] } = useQuery<Diagnosis[]>({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => opdService.listDiagnoses(encounterId),
  });

  const { data: patientDiagnoses = [] } = useQuery<PatientDiagnosisRow[]>({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => opdService.listPatientDiagnoses(patientId),
    staleTime: 120_000,
  });

  const invalidateDiagnosisQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["diagnoses", encounterId] });
    void queryClient.invalidateQueries({ queryKey: ["patient-diagnoses", patientId] });
  };

  // One flag drove all three: the parent passed `opd.visit.update` as canCreate,
  // canUpdate AND canDelete. Recording a diagnosis, amending one and removing one
  // are three acts with three codes, and deleting a diagnosis from a chart is not
  // the same permission as writing one.
  const canCreateDiagnosis = useHasPermission(P.OPD.DIAGNOSES_CREATE);
  const canUpdateDiagnosis = useHasPermission(P.OPD.DIAGNOSES_UPDATE);
  const canDeleteDiagnosis = useHasPermission(P.OPD.DIAGNOSES_DELETE);
  const createMutation = useMutation({
    mutationFn: (data: CreateDiagnosisRequest) => opdService.createDiagnosis(encounterId, data),
    onSuccess: invalidateDiagnosisQueries,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      diagnosisEncounterId,
      diagnosisId,
      data,
    }: {
      diagnosisEncounterId: string;
      diagnosisId: string;
      data: UpdateDiagnosisRequest;
    }) => opdService.updateDiagnosis(diagnosisEncounterId, diagnosisId, data),
    onSuccess: invalidateDiagnosisQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => opdService.deleteDiagnosis(encounterId, id),
    onSuccess: invalidateDiagnosisQueries,
  });

  return (
    <DiagnosisPanel
      encounterId={encounterId}
      diagnoses={diagnoses}
      patientDiagnoses={patientDiagnoses}
      canCreate={canCreateDiagnosis}
      canUpdate={canUpdateDiagnosis}
      canDelete={canDeleteDiagnosis}
      onAdd={(data) => createMutation.mutate(data)}
      onUpdate={(diagnosisEncounterId, diagnosisId, data) =>
        updateMutation.mutate({ diagnosisEncounterId, diagnosisId, data })
      }
      onDelete={(id) => deleteMutation.mutate(id)}
      isAdding={createMutation.isPending}
      isUpdating={updateMutation.isPending}
    />
  );
}

// ── Investigations ───────────────────────────────────────
