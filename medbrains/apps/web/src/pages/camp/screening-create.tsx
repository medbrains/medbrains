import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CampScreeningFormInput } from "@medbrains/schemas";
import { campScreeningFormSchema } from "@medbrains/schemas";
import type {
  CampRegistration,
  CreateCampScreeningRequest,
  CreateVitalRequest,
} from "@medbrains/types";
import {
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
} from "@medbrains/types";
import { IconArrowLeft, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { VitalsRecorder } from "@/components/Clinical/VitalsRecorder";
import { Alert, Button } from "@/components/ui";
import {
  campHistoryAnswer,
  campIcdCodes,
  campOptionalInteger,
  campOptionalNumber,
  campOptionalText,
} from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CampScreeningHistoryFields, CampScreeningTestFields } from "./screening-history-fields";
import { campRegistrationOptionLabel, campWorkPath } from "./shared";

/**
 * Recording a camp screening — vitals, medical history, bedside tests,
 * findings and a referral decision — on a screen of its own.
 *
 * `camp/:campId/work/screenings/new` was routed and led to the workspace
 * tab; the form only opened as a right-hand drawer. It is the longest form
 * in the camp module, and a third of the screen was the wrong place for it:
 * this is filled with the patient in front of you, and it decides whether
 * they are referred on.
 *
 * A registration can be preselected through `?registration_id=`, which is
 * how the registrations tab hands a participant straight to screening.
 */
export function CampScreeningCreatePage() {
  useRequirePermission(P.CAMP.SCREENINGS_MANAGE);

  return (
    <ClinicalEventProvider moduleCode="camp" contextCode="camp-screening-create">
      <CampScreeningCreatePageInner />
    </ClinicalEventProvider>
  );
}

function CampScreeningCreatePageInner() {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const presetRegistrationId = searchParams.get("registration_id") ?? "";
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const [screeningVitals, setScreeningVitals] = useState<CreateVitalRequest>({});

  const backToList = () => navigate(campWorkPath(campId ?? "", contextPatientId, "screenings"));

  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId ?? null, "screening-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: campId ?? "" }),
    enabled: Boolean(campId),
  });
  const registrationsById = useMemo(
    () => new Map(registrations.map((r: CampRegistration) => [r.id, r])),
    [registrations],
  );
  const registrationOptions = useMemo(
    () =>
      registrations.map((registration: CampRegistration) => ({
        value: registration.id,
        label: campRegistrationOptionLabel(registration, {
          name: campNameAccess,
          phone: campPhoneAccess,
        }),
      })),
    [campNameAccess, campPhoneAccess, registrations],
  );
  const referralUrgencyOptions = useMemo(
    () => [
      { value: "routine", label: t("screenings.referralUrgency.routine") },
      { value: "urgent", label: t("screenings.referralUrgency.urgent") },
      { value: "emergency", label: t("screenings.referralUrgency.emergency") },
    ],
    [t],
  );

  const screeningDefaults: CampScreeningFormInput = {
    registration_id: presetRegistrationId,
    bp_systolic: "",
    bp_diastolic: "",
    pulse_rate: "",
    spo2: "",
    temperature: "",
    blood_sugar_random: "",
    bmi: "",
    height_cm: "",
    weight_kg: "",
    visual_acuity_left: "",
    visual_acuity_right: "",
    mh_diabetes: "",
    mh_hypertension: "",
    mh_asthma: "",
    mh_heart_disease: "",
    mh_thyroid_disorder: "",
    mh_previous_surgeries: "",
    mh_allergies: "",
    mh_smoking_history: "",
    mh_alcohol_use: "",
    mh_family_history: "",
    mh_others: "",
    medical_history_notes: "",
    test_hba1c: "",
    test_haemoglobin: "",
    test_thyroid: "",
    test_ecg: "",
    test_xray: "",
    test_bmd: "",
    test_biothesiometry: "",
    findings: "",
    diagnosis: "",
    advice: "",
    referred_to_hospital: false,
    referral_department: "",
    referral_doctor_name: "",
    referral_urgency: "",
    icd_codes: "",
  };
  const {
    control: screeningControl,
    register: registerScreening,
    handleSubmit: handleSubmitScreening,
    watch: watchScreening,
    formState: { errors: screeningErrors },
  } = useForm<CampScreeningFormInput>({
    resolver: zodResolver(campScreeningFormSchema),
    defaultValues: screeningDefaults,
  });
  const referredToHospital = watchScreening("referred_to_hospital");

  const scrMut = useMutation({
    mutationFn: (data: CreateCampScreeningRequest) => campService.createCampScreening(data),
    onSuccess: (screening) => {
      const registration = registrationsById.get(screening.registration_id);
      if (registration?.patient_id) {
        emit("camp.screening.completed", {
          camp_id: registration.camp_id,
          patient_id: registration.patient_id,
          registration_id: registration.id,
          registration_number: registration.registration_number,
          screening_id: screening.id,
          source_record_id: screening.id,
        });
      }
      void qc.invalidateQueries({ queryKey: ["camp-screenings"] });
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      backToList();
      notifications.show({
        title: t("notify.screeningRecorded"),
        message: t("notify.screeningSaved"),
        color: "success",
      });
    },
  });

  const handleCreateScreening = (values: CampScreeningFormInput) => {
    const heightCm = screeningVitals.height_cm ?? campOptionalNumber(values.height_cm);
    const weightKg = screeningVitals.weight_kg ?? campOptionalNumber(values.weight_kg);
    const enteredBmi = campOptionalNumber(values.bmi);
    const calculatedBmi =
      enteredBmi ??
      (heightCm && weightKg
        ? Math.round((weightKg / (heightCm / 100) ** 2) * 100) / 100
        : undefined);

    scrMut.mutate({
      registration_id: values.registration_id.trim(),
      bp_systolic: screeningVitals.systolic_bp ?? campOptionalInteger(values.bp_systolic),
      bp_diastolic: screeningVitals.diastolic_bp ?? campOptionalInteger(values.bp_diastolic),
      pulse_rate: screeningVitals.pulse ?? campOptionalInteger(values.pulse_rate),
      spo2: screeningVitals.spo2 ?? campOptionalInteger(values.spo2),
      temperature: screeningVitals.temperature ?? campOptionalNumber(values.temperature),
      blood_sugar_random: campOptionalNumber(values.blood_sugar_random),
      bmi: calculatedBmi,
      height_cm: heightCm,
      weight_kg: weightKg,
      visual_acuity_left: campOptionalText(values.visual_acuity_left),
      visual_acuity_right: campOptionalText(values.visual_acuity_right),
      findings: campOptionalText(values.findings),
      diagnosis: campOptionalText(values.diagnosis),
      advice: campOptionalText(values.advice),
      referred_to_hospital: values.referred_to_hospital,
      referral_department: values.referred_to_hospital
        ? campOptionalText(values.referral_department)
        : undefined,
      referral_urgency: values.referred_to_hospital
        ? campOptionalText(values.referral_urgency)
        : undefined,
      referral_doctor_name: values.referred_to_hospital
        ? campOptionalText(values.referral_doctor_name)
        : undefined,
      mh_diabetes: campHistoryAnswer(values.mh_diabetes),
      mh_hypertension: campHistoryAnswer(values.mh_hypertension),
      mh_asthma: campHistoryAnswer(values.mh_asthma),
      mh_heart_disease: campHistoryAnswer(values.mh_heart_disease),
      mh_thyroid_disorder: campHistoryAnswer(values.mh_thyroid_disorder),
      mh_previous_surgeries: campHistoryAnswer(values.mh_previous_surgeries),
      mh_allergies: campHistoryAnswer(values.mh_allergies),
      mh_smoking_history: campHistoryAnswer(values.mh_smoking_history),
      mh_alcohol_use: campHistoryAnswer(values.mh_alcohol_use),
      mh_family_history: campHistoryAnswer(values.mh_family_history),
      mh_others: campHistoryAnswer(values.mh_others),
      medical_history_notes: campOptionalText(values.medical_history_notes),
      test_hba1c: campOptionalNumber(values.test_hba1c),
      test_haemoglobin: campOptionalNumber(values.test_haemoglobin),
      test_thyroid: campOptionalNumber(values.test_thyroid),
      test_ecg: campOptionalText(values.test_ecg),
      test_xray: campOptionalText(values.test_xray),
      test_bmd: campOptionalText(values.test_bmd),
      test_biothesiometry: campOptionalText(values.test_biothesiometry),
      icd_codes: campIcdCodes(values.icd_codes),
    });
  };

  return (
    <Stack>
      <PageHeader
        title={t("screenings.drawer.title")}
        icon={<IconStethoscope size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            {t("screenings.title")}
          </Button>
        }
      />
      {campId ? (
        <Stack component="form" onSubmit={handleSubmitScreening(handleCreateScreening)}>
          <Controller
            control={screeningControl}
            name="registration_id"
            render={({ field }) => (
              <Select
                label={t("common.campParticipant")}
                placeholder={t("common.searchRegistrationNamePhone")}
                data={registrationOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                required
                searchable
                error={screeningErrors.registration_id?.message}
              />
            )}
          />
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t("screenings.form.vitals")}
            </Text>
            <VitalsRecorder onChange={setScreeningVitals} showActions={false} showNotes={false} />
          </Stack>
          <Controller
            control={screeningControl}
            name="blood_sugar_random"
            render={({ field }) => (
              <NumberInput
                label={t("screenings.form.randomBloodSugar")}
                decimalScale={1}
                value={field.value}
                onChange={field.onChange}
                min={0}
                error={screeningErrors.blood_sugar_random?.message}
              />
            )}
          />
          <Group grow>
            <TextInput
              label={t("screenings.form.visualAcuityLeft")}
              {...registerScreening("visual_acuity_left")}
            />
            <TextInput
              label={t("screenings.form.visualAcuityRight")}
              {...registerScreening("visual_acuity_right")}
            />
          </Group>
          <CampScreeningHistoryFields control={screeningControl} />
          <CampScreeningTestFields control={screeningControl} />
          <Textarea label={t("screenings.form.findings")} {...registerScreening("findings")} />
          <Textarea
            label={t("screenings.form.provisionalDiagnosis")}
            {...registerScreening("diagnosis")}
          />
          <TextInput
            label={t("screenings.form.icdCodes")}
            placeholder="M25.5, E11.9"
            description={t("screenings.form.icdCodesHint")}
            {...registerScreening("icd_codes")}
          />
          <Textarea label={t("screenings.form.advice")} {...registerScreening("advice")} />
          <Controller
            control={screeningControl}
            name="referred_to_hospital"
            render={({ field }) => (
              <Switch
                label={t("screenings.form.referToHospital")}
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {referredToHospital && (
            <Group grow>
              <TextInput
                label={t("screenings.form.referralDepartment")}
                {...registerScreening("referral_department")}
              />
              <TextInput
                label={t("screenings.form.referralDoctor")}
                {...registerScreening("referral_doctor_name")}
              />
              <Controller
                control={screeningControl}
                name="referral_urgency"
                render={({ field }) => (
                  <Select
                    label={t("screenings.form.urgency")}
                    data={referralUrgencyOptions}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? "")}
                    clearable
                  />
                )}
              />
            </Group>
          )}
          <Button tone="primary" type="submit" loading={scrMut.isPending}>
            {t("screenings.actions.saveScreening")}
          </Button>
        </Stack>
      ) : (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
