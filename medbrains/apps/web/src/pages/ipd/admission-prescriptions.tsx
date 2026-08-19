// IPD AdmissionPrescriptionsTab — split from ipd.tsx (pure move).

import { Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreatePrescriptionRequest,
  PatientAllergy,
  PrescriptionWithItems,
  UpdatePrescriptionRequest,
} from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PrescriptionViews, useProtectedFieldAccess } from "@/components";
import { toast } from "@/components/ui";
import { RxSuiteWriter } from "@/features/prescription/RxSuiteWriter";
import { ipdService } from "@/services/ipd.service";
import { protectedIpdPatientIdentifier, protectedIpdPatientName } from "./shared";

export function AdmissionPrescriptionsTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission(P.OPD.VISIT_UPDATE);
  // Writing the visit is not permission to read the patient. As on the nurse
  // prescribing tab, an empty ALLERGY list here reads as "no known allergies".
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const { data: prescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["encounter-prescriptions", encounterId],
    queryFn: () => ipdService.listPrescriptions(encounterId),
  });

  const { data: patient } = useQuery({
    queryKey: ["patient-detail", patientId],
    queryFn: () => ipdService.getPatient(patientId),
    enabled: canViewPatient,
  });

  const { data: allergies = [] } = useQuery<PatientAllergy[]>({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => ipdService.listPatientAllergies(patientId),
    enabled: canViewPatient,
  });
  const allergyNames = allergies.filter((a) => a.is_active).map((a) => a.allergen_name);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["encounter-prescriptions", encounterId] });
  const createMutation = useMutation({
    mutationFn: (data: CreatePrescriptionRequest) =>
      ipdService.createPrescription(encounterId, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Prescription blocked" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      data,
    }: {
      prescriptionId: string;
      data: UpdatePrescriptionRequest;
    }) => ipdService.updatePrescription(prescriptionId, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Prescription blocked" }),
  });

  const fullName = patient
    ? `${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim()
    : patientId.slice(0, 8);
  const uhid = patient?.uhid ?? patientId.slice(0, 8);
  const patientName = protectedIpdPatientName(fullName, patientNameAccess);
  const patientUhid = protectedIpdPatientIdentifier(uhid, uhidAccess);

  return (
    <Stack gap="md">
      <RxSuiteWriter
        encounterId={encounterId}
        patientId={patientId}
        prescriptions={prescriptions}
        canUpdate={canWrite}
        onSave={(data) => createMutation.mutate(data)}
        onUpdate={(prescriptionId, data) => updateMutation.mutate({ prescriptionId, data })}
        isSaving={createMutation.isPending}
        isUpdating={updateMutation.isPending}
        patientName={patientName}
        uhid={patientUhid}
        allergies={allergyNames}
      />
      {prescriptions.length > 0 && (
        <PrescriptionViews
          prescriptions={prescriptions}
          patientName={patientName}
          uhid={patientUhid}
          allergies={allergyNames}
        />
      )}
    </Stack>
  );
}

// ── I/O Chart ──────────────────────────────────────────
