// IPD NurseRxTab — split from nurse-activities.tsx (pure move).

import { useHasPermission } from "@medbrains/stores";
import type {
  CreatePrescriptionRequest,
  PatientAllergy,
  PrescriptionWithItems,
  UpdatePrescriptionRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui";
import { RxSuiteWriter } from "@/features/prescription/RxSuiteWriter";
import { opdService } from "@/services/opd.service";

export function NurseRxTab({ encounterId, patientId }: { encounterId: string; patientId: string }) {
  const qc = useQueryClient();
  const canDraft = useHasPermission(P.NURSE.PRESCRIPTIONS_DRAFT);

  const { data: prescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["encounter-prescriptions", encounterId],
    queryFn: () => opdService.listPrescriptions(encounterId),
  });
  const { data: patient } = useQuery({
    queryKey: ["patient-detail", patientId],
    queryFn: () => opdService.getPatient(patientId),
    enabled: Boolean(patientId),
  });
  const { data: allergies = [] } = useQuery<PatientAllergy[]>({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => opdService.listPatientAllergies(patientId),
    enabled: Boolean(patientId),
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["encounter-prescriptions", encounterId] });
  const createMutation = useMutation({
    mutationFn: (data: CreatePrescriptionRequest) =>
      opdService.createPrescription(encounterId, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Could not create prescription" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      data,
    }: {
      prescriptionId: string;
      data: UpdatePrescriptionRequest;
    }) => opdService.updatePrescription(prescriptionId, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Could not update prescription" }),
  });

  const patientName = patient
    ? `${patient.first_name} ${patient.last_name}`.trim()
    : patientId.slice(0, 8);

  return (
    <RxSuiteWriter
      encounterId={encounterId}
      patientId={patientId}
      prescriptions={prescriptions}
      canUpdate={canDraft}
      onSave={(data) => createMutation.mutate(data)}
      onUpdate={(prescriptionId, data) => updateMutation.mutate({ prescriptionId, data })}
      isSaving={createMutation.isPending}
      isUpdating={updateMutation.isPending}
      patientName={patientName}
      uhid={patient?.uhid ?? patientId.slice(0, 8)}
      allergies={allergies.filter((a) => a.is_active).map((a) => a.allergen_name)}
      prescriber="nurse"
    />
  );
}
