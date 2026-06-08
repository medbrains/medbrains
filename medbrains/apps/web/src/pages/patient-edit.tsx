import { Group, Loader, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CreatePatientRequest, UpdatePatientRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { ClinicalEventProvider, PageHeader, useClinicalEmit } from "@/components";
import { PatientRegisterForm } from "@/components/Patient/PatientRegisterForm";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { patientsService } from "@/services/patients.service";

export function PatientEditPage() {
  return (
    <ClinicalEventProvider moduleCode="patients" contextCode="patient-edit">
      <PatientEditPageInner />
    </ClinicalEventProvider>
  );
}

function PatientEditPageInner() {
  useRequirePermission(P.PATIENTS.UPDATE);
  const { t } = useTranslation("patients");
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsService.getPatient(patientId),
    enabled: Boolean(patientId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePatientRequest) => patientsService.updatePatient(patientId, data),
    onSuccess: (row) => {
      emit("patient.updated", {
        source_record_id: row.id,
        patient_id: row.id,
      });
      notifications.show({
        title: t("notify.patientUpdated"),
        message: t("notify.changesSaved"),
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      navigate(`/patients/${patientId}`);
    },
    onError: (err: Error) => {
      notifications.show({
        title: t("notify.updateFailed"),
        message: err.message || t("errors.unknown"),
        color: "danger",
      });
    },
  });

  if (isLoading || !patient) {
    return (
      <div>
        <PageHeader title={t("registrationForm.title.edit")} subtitle={t("loading...")} />
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </div>
    );
  }

  const handleSubmit = (req: CreatePatientRequest) => {
    const update: UpdatePatientRequest = {
      first_name: req.first_name,
      last_name: req.last_name,
      gender: req.gender,
      phone: req.phone,
      date_of_birth: req.date_of_birth,
      email: req.email,
      prefix: req.prefix,
      middle_name: req.middle_name,
      suffix: req.suffix,
      father_name: req.father_name,
      guardian_name: req.guardian_name,
      guardian_relation: req.guardian_relation,
      marital_status: req.marital_status,
      religion: req.religion,
      blood_group: req.blood_group,
      occupation: req.occupation,
      phone_secondary: req.phone_secondary,
      category: req.category,
      registration_type: req.registration_type,
      registration_source: req.registration_source,
      financial_class: req.financial_class,
      is_medico_legal: req.is_medico_legal,
      mlc_number: req.mlc_number,
      is_vip: req.is_vip,
      address: req.address,
    };
    updateMutation.mutate(update);
  };

  return (
    <Stack>
      <PageHeader
        title={t("registrationForm.title.edit")}
        subtitle={`${patient.first_name} ${patient.last_name} · ${patient.uhid}`}
      />
      <PatientRegisterForm
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/patients/${patientId}`)}
        isSubmitting={updateMutation.isPending}
        mode="edit"
        submitLabel={t("actions.save")}
        initialValues={{
          prefix: patient.prefix ?? undefined,
          first_name: patient.first_name,
          middle_name: patient.middle_name ?? undefined,
          last_name: patient.last_name,
          suffix: patient.suffix ?? undefined,
          date_of_birth: patient.date_of_birth ?? undefined,
          is_dob_estimated: patient.is_dob_estimated,
          gender: patient.gender,
          phone: patient.phone ?? "",
          phone_secondary: patient.phone_secondary ?? undefined,
          email: patient.email ?? undefined,
          blood_group: patient.blood_group ?? undefined,
          marital_status: patient.marital_status ?? undefined,
          religion: patient.religion ?? undefined,
          occupation: patient.occupation ?? undefined,
          father_name: patient.father_name ?? undefined,
          guardian_name: patient.guardian_name ?? undefined,
          guardian_relation: patient.guardian_relation ?? undefined,
          category: patient.category ?? undefined,
          known_allergies:
            (
              patient.attributes as Record<string, unknown> | null | undefined
            )?.known_allergies?.toString() ?? undefined,
          drug_allergies:
            (
              patient.attributes as Record<string, unknown> | null | undefined
            )?.drug_allergies?.toString() ?? undefined,
        }}
      />
    </Stack>
  );
}
