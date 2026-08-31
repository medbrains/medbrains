import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CampRegistrationFormInput } from "@medbrains/schemas";
import { campRegistrationFormSchema } from "@medbrains/schemas";
import type { CreateCampRegistrationRequest, DepartmentRow } from "@medbrains/types";
import {
  CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconArrowLeft, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  DoctorSearchSelect,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { Alert, Button } from "@/components/ui";
import { campIdProofTypeOptions, campOptionalInteger, campOptionalText } from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { CAMP_SERVICE_LINE_OPTIONS, campWorkPath } from "./shared";

/**
 * Registering a participant at a camp, on a screen of its own.
 *
 * `/camp/:campId/work/registrations/new` was already routed and already had
 * a path helper — but the component behind it returned the camp workspace
 * with the registrations tab selected and nothing more. The URL worked, the
 * form did not open, and the only way to reach it remained a right-hand
 * drawer behind a button. Seven other camp routes are still facades of the
 * same kind.
 *
 * The drawer mattered here more than most: this is a fifteen-field intake
 * form, filled at a trestle table with a queue in front of it, and a
 * right-hand panel gave it a third of the screen.
 */
export function CampRegistrationCreatePage() {
  useRequirePermission(P.CAMP.REGISTRATIONS_CREATE);

  return (
    <ClinicalEventProvider moduleCode="camp" contextCode="camp-registration-create">
      <CampRegistrationCreatePageInner />
    </ClinicalEventProvider>
  );
}

const REGISTRATION_DEFAULTS: CampRegistrationFormInput = {
  person_name: "",
  age: "",
  gender: "",
  phone: "",
  address: "",
  id_proof_type: "",
  id_proof_number: "",
  father_spouse_name: "",
  marital_status: "",
  blood_group: "",
  insurance_details: "",
  clinical_department_id: null,
  attending_doctor_id: null,
  service_line: "",
  chief_complaint: "",
  is_walk_in: true,
};

function CampRegistrationCreatePageInner() {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  // Carried through the URL exactly as the workspace carries it, so a
  // participant registered while a patient is in context is still attached
  // to that patient's record rather than starting a second one.
  const contextPatientId = searchParams.get("patient_id") ?? "";

  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const campIdProofAccess = useProtectedFieldAccess(CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY);
  const canEditCampName = campNameAccess === "edit";
  const canEditCampPhone = campPhoneAccess === "edit";
  const canEditCampIdProof = campIdProofAccess === "edit";

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampRegistrationFormInput>({
    resolver: zodResolver(campRegistrationFormSchema),
    defaultValues: REGISTRATION_DEFAULTS,
  });

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const backToList = () => navigate(campWorkPath(campId ?? "", contextPatientId, "registrations"));

  const createMut = useMutation({
    mutationFn: (data: CreateCampRegistrationRequest) => campService.createCampRegistration(data),
    onSuccess: (registration) => {
      if (registration.patient_id) {
        emit("camp.registration.created", {
          camp_id: registration.camp_id,
          patient_id: registration.patient_id,
          registration_number: registration.registration_number,
          registration_id: registration.id,
          source_record_id: registration.id,
        });
      }
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      notifications.show({
        title: t("notify.registered"),
        message: t("notify.participantRegistered"),
        color: "success",
      });
      backToList();
    },
  });

  const submit = (values: CampRegistrationFormInput) => {
    if (!campId) return;
    createMut.mutate({
      camp_id: campId,
      person_name: values.person_name.trim(),
      age: campOptionalInteger(values.age),
      gender: campOptionalText(values.gender),
      phone: campOptionalText(values.phone),
      address: campOptionalText(values.address),
      id_proof_type: campOptionalText(values.id_proof_type),
      id_proof_number: campOptionalText(values.id_proof_number),
      father_spouse_name: campOptionalText(values.father_spouse_name),
      marital_status: campOptionalText(values.marital_status),
      blood_group: campOptionalText(values.blood_group),
      insurance_details: campOptionalText(values.insurance_details),
      clinical_department_id: values.clinical_department_id ?? undefined,
      attending_doctor_id: values.attending_doctor_id ?? undefined,
      service_line: campOptionalText(values.service_line),
      chief_complaint: campOptionalText(values.chief_complaint),
      is_walk_in: values.is_walk_in,
      patient_id: contextPatientId || undefined,
    });
  };

  return (
    <Stack>
      <PageHeader
        title="Register Participant"
        icon={<IconUserPlus size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            Registrations
          </Button>
        }
      />
      {campId ? (
        <Stack component="form" onSubmit={handleSubmit(submit)} maw={760}>
          <TextInput
            label="Person Name"
            required
            error={errors.person_name?.message}
            disabled={!canEditCampName}
            {...register("person_name")}
          />
          <Group grow>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <NumberInput
                  label="Age"
                  min={0}
                  max={150}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.age?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  label="Gender"
                  data={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.gender?.message}
                  clearable
                />
              )}
            />
          </Group>
          <TextInput
            label="Phone"
            error={errors.phone?.message}
            disabled={!canEditCampPhone}
            {...register("phone")}
          />
          <Textarea label="Address" error={errors.address?.message} {...register("address")} />
          <Group grow>
            <Controller
              control={control}
              name="clinical_department_id"
              render={({ field }) => (
                <Select
                  label="Service department"
                  placeholder="Optional at registration"
                  data={departmentOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  error={errors.clinical_department_id?.message}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="attending_doctor_id"
              render={({ field }) => (
                <DoctorSearchSelect
                  label="Attending doctor"
                  placeholder="Optional at registration"
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value || null)}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="service_line"
            render={({ field }) => (
              <Select
                label="Camp service needed"
                placeholder="Opinion, X-ray, lab, pharmacy..."
                data={CAMP_SERVICE_LINE_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.service_line?.message}
                clearable
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={campIdProofTypeOptions}
                  placeholder="Select ID type"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.id_proof_type?.message}
                  clearable
                  searchable
                  disabled={!canEditCampIdProof}
                />
              )}
            />
            <TextInput
              label="ID Proof Number"
              error={errors.id_proof_number?.message}
              disabled={!canEditCampIdProof}
              {...register("id_proof_number")}
            />
          </Group>
          <Group grow>
            {/* The identifier a rural register actually uses to tell two
                same-named people apart. */}
            <TextInput
              label="Father / Spouse name"
              error={errors.father_spouse_name?.message}
              {...register("father_spouse_name")}
            />
            <TextInput
              label="Marital status"
              error={errors.marital_status?.message}
              {...register("marital_status")}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Blood group"
              placeholder="O+"
              description="As reported at the desk, not from a typed sample"
              error={errors.blood_group?.message}
              {...register("blood_group")}
            />
            <TextInput
              label="Insurance name / number"
              error={errors.insurance_details?.message}
              {...register("insurance_details")}
            />
          </Group>
          <Textarea
            label="Chief Complaint"
            error={errors.chief_complaint?.message}
            {...register("chief_complaint")}
          />
          <Controller
            control={control}
            name="is_walk_in"
            render={({ field }) => (
              <Switch
                label="Walk-in"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Group>
            <Button tone="primary" type="submit" loading={createMut.isPending}>
              Register
            </Button>
            <Button tone="ghost" onClick={backToList}>
              Cancel
            </Button>
          </Group>
        </Stack>
      ) : (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
