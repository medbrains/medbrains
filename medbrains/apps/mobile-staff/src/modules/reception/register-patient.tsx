/**
 * Reception -> register a new patient. The mobile form captures the
 * referral/camp/clinical ownership context needed before OPD starts.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type GenderFormValue,
  type MobileStaffPatientRegistrationFormInput,
  mobileStaffPatientRegistrationFormSchema,
  type ReferredByKindFormValue,
  type RegistrationSourceFormValue,
  type RegistrationTypeFormValue,
} from "@medbrains/schemas";
import type {
  Camp,
  DepartmentRow,
  Facility,
  SetupUser,
  TerminologySearchResult,
} from "@medbrains/types";
import { Card, COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ComponentProps, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { Control, FieldPath, FieldPathValue } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import type { CreatePatientPayload } from "../../api/patients.js";
import { createPatient } from "../../api/patients.js";
import { listCamps, listDepartments, listDoctors, listFacilities } from "../../api/references.js";
import { searchTerminology } from "../../api/terminology.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ReferenceMenu } from "../../components/reference-menu.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

type ReferenceState = {
  departments: DepartmentRow[];
  doctors: SetupUser[];
  camps: Camp[];
  facilities: Facility[];
};

const registrationTypeOptions: Array<{ id: RegistrationTypeFormValue; label: string }> = [
  { id: "new", label: "New" },
  { id: "revisit", label: "Revisit" },
  { id: "transfer_in", label: "Transfer in" },
  { id: "referral", label: "Referral" },
  { id: "emergency", label: "Emergency" },
  { id: "camp", label: "Camp" },
  { id: "telemedicine", label: "Telemedicine" },
  { id: "pre_registration", label: "Pre-registration" },
];

const registrationSourceOptions: Array<{ id: RegistrationSourceFormValue; label: string }> = [
  { id: "walk_in", label: "Walk-in" },
  { id: "phone", label: "Phone" },
  { id: "online_portal", label: "Online portal" },
  { id: "mobile_app", label: "Mobile app" },
  { id: "kiosk", label: "Kiosk" },
  { id: "referral", label: "Referral" },
  { id: "ambulance", label: "Ambulance" },
  { id: "camp", label: "Camp" },
  { id: "telemedicine", label: "Telemedicine" },
];

const genderButtons: Array<{ value: GenderFormValue; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const referralTypeOptions: Array<{ id: ReferredByKindFormValue; label: string }> = [
  { id: "doctor", label: "Doctor" },
  { id: "asha", label: "ASHA" },
  { id: "camp_worker", label: "Camp worker" },
  { id: "facility", label: "Facility / hospital" },
  { id: "ngo", label: "NGO" },
  { id: "self", label: "Self / walk-in" },
  { id: "other", label: "Other" },
];

export function RegisterPatientScreen(): ReactNode {
  const router = useModuleRouter();
  const { data: refs } = useFetch<ReferenceState>(async () => {
    const [departments, doctors, camps, facilities] = await Promise.all([
      listDepartments(),
      listDoctors(),
      listCamps(),
      listFacilities(),
    ]);
    return { departments, doctors, camps, facilities };
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<MobileStaffPatientRegistrationFormInput>({
    resolver: zodResolver(mobileStaffPatientRegistrationFormSchema),
    mode: "onChange",
    defaultValues: {
      first_name: "",
      last_name: "",
      gender: "male",
      phone: "",
      date_of_birth: "",
      age: "",
      registration_type: "new",
      registration_source: "walk_in",
      camp_id: "",
      camp_name: "",
      referred_by_kind: "self",
      referred_by_user_id: "",
      referred_by_facility_id: "",
      referred_by_name: "",
      referred_by_phone: "",
      referred_by_facility: "",
      department_id: "",
      consultant_id: "",
      clinical_unit: "",
      diagnosis_text: "",
      icd11_code: "",
      is_medico_legal: false,
      mlc_number: "",
      is_vip: false,
    },
  });
  const setLinkedValue = <Name extends FieldPath<MobileStaffPatientRegistrationFormInput>>(
    name: Name,
    value: FieldPathValue<MobileStaffPatientRegistrationFormInput, Name>,
  ) => {
    setValue(name, value, { shouldDirty: true, shouldValidate: true });
  };

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [icd11Search, setIcd11Search] = useState("");
  const [selectedIcd11Result, setSelectedIcd11Result] = useState<TerminologySearchResult | null>(
    null,
  );

  const values = watch();
  const departments = refs?.departments ?? [];
  const doctors = refs?.doctors ?? [];
  const camps = refs?.camps.filter((camp) => camp.status !== "cancelled") ?? [];
  const facilities = refs?.facilities.filter((facility) => facility.is_active) ?? [];
  const visibleDoctors = useMemo(
    () =>
      values.department_id
        ? doctors.filter(
            (doctor) => doctor.is_active && doctor.department_ids.includes(values.department_id),
          )
        : doctors.filter((doctor) => doctor.is_active),
    [values.department_id, doctors],
  );
  const selectedDepartment = departments.find(
    (department) => department.id === values.department_id,
  );
  const selectedDoctor = doctors.find((doctor) => doctor.id === values.consultant_id);
  const selectedCamp = camps.find((camp) => camp.id === values.camp_id);
  const selectedReferredDoctor = doctors.find((doctor) => doctor.id === values.referred_by_user_id);
  const selectedReferralFacility = facilities.find(
    (facility) => facility.id === values.referred_by_facility_id,
  );
  const { data: icd11Results, loading: icd11Loading } = useFetch<TerminologySearchResult[]>(() => {
    const q = icd11Search.trim();
    if (q.length < 2) return Promise.resolve([]);
    return searchTerminology({ system: "icd11", q, limit: 12 });
  }, [icd11Search]);
  const icd11Rows = useMemo(
    () =>
      (icd11Loading && icd11Search.trim().length >= 2 ? [] : (icd11Results ?? [])).map(
        (result) => ({
          id: result.code,
          label: `${result.code} - ${result.display}`,
          result,
        }),
      ),
    [icd11Loading, icd11Results, icd11Search],
  );

  const submit = handleSubmit(async (formValues) => {
    setError(null);
    setBusy(true);
    try {
      const dateOfBirth = formValues.date_of_birth.trim() || estimateDobFromAge(formValues.age);
      const payload: CreatePatientPayload = {
        first_name: formValues.first_name.trim(),
        last_name: formValues.last_name.trim(),
        gender: formValues.gender,
        phone: formValues.phone.trim(),
        date_of_birth: dateOfBirth,
        is_dob_estimated: !formValues.date_of_birth.trim() && Boolean(formValues.age.trim()),
        registration_type: formValues.registration_type,
        registration_source: formValues.registration_source,
        referred_by_name: blankToUndefined(formValues.referred_by_name),
        referred_by_phone: blankToUndefined(formValues.referred_by_phone),
        referred_by_facility: blankToUndefined(formValues.referred_by_facility),
        department_id: blankToUndefined(formValues.department_id),
        department_name: selectedDepartment?.name,
        consultant_id: blankToUndefined(formValues.consultant_id),
        consultant_name: selectedDoctor?.full_name,
        clinical_unit: blankToUndefined(formValues.clinical_unit),
        camp_id: blankToUndefined(formValues.camp_id),
        camp_name: blankToUndefined(formValues.camp_name),
        initial_diagnosis_text: blankToUndefined(formValues.diagnosis_text),
        icd11_code: blankToUndefined(formValues.icd11_code),
        icd11_display: selectedIcd11Result?.display,
        icd11_source_url: selectedIcd11Result?.source_url ?? undefined,
        icd11_source_version: selectedIcd11Result?.source_version ?? undefined,
        icd11_provider_mode: selectedIcd11Result?.provider_mode,
        is_medico_legal: formValues.is_medico_legal,
        mlc_number: formValues.is_medico_legal
          ? blankToUndefined(formValues.mlc_number)
          : undefined,
        is_vip: formValues.is_vip,
        attributes: {
          mobile_registration: {
            source: formValues.registration_source,
            camp_reference: formValues.camp_id || formValues.camp_name || null,
            referred_by_kind: formValues.referred_by_kind,
            referred_by_user_id: formValues.referred_by_user_id || null,
            referred_by: formValues.referred_by_name || null,
            referred_by_facility_id: formValues.referred_by_facility_id || null,
            concerned_department: selectedDepartment?.name ?? null,
            concerned_consultant: selectedDoctor?.full_name ?? null,
            provisional_diagnosis: formValues.diagnosis_text || null,
          },
        },
      };
      const created = await createPatient(payload);
      router.replace("patient-detail", created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="RECEPTION"
        title="Register patient"
        description="OPD, referral and camp registration with department, consultant and safety context."
      />
      <FormScrollView>
        <Card eyebrow="Identity" title="Patient">
          <View style={{ gap: SPACING.sm }}>
            <FormTextField control={control} name="first_name" label="First name" required />
            <FormTextField control={control} name="last_name" label="Last name" required />
            <Text variant="labelMedium" style={{ color: COLORS.ink }}>
              Gender
            </Text>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={genderButtons}
                />
              )}
            />
            <FormTextField
              control={control}
              name="phone"
              label="Phone"
              required
              keyboardType="phone-pad"
            />
            <FormTextField
              control={control}
              name="date_of_birth"
              label="Date of birth"
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <FormTextField
              control={control}
              name="age"
              label="Age"
              placeholder="Auto-estimates DOB if DOB is empty"
              keyboardType="number-pad"
            />
          </View>
        </Card>

        <Card eyebrow="Source" title="Patient type and referral" pattern="aqua">
          <View style={{ gap: SPACING.sm }}>
            <ReferenceMenu
              title="Patient type"
              rows={registrationTypeOptions}
              selectedId={values.registration_type}
              label={(row) => row.label}
              placeholder="Select patient type"
              onSelect={(row) => {
                setLinkedValue("registration_type", row.id);
                if (row.id === "camp") {
                  setLinkedValue("registration_source", "camp");
                }
                if (row.id === "referral") {
                  setLinkedValue("registration_source", "referral");
                }
              }}
            />
            <ReferenceMenu
              title="Source"
              rows={registrationSourceOptions}
              selectedId={values.registration_source}
              label={(row) => row.label}
              placeholder="Select registration source"
              onSelect={(row) => setLinkedValue("registration_source", row.id)}
            />
            <ReferenceMenu
              title="Camp reference"
              rows={camps}
              selectedId={values.camp_id}
              label={campLabel}
              placeholder="Select existing camp"
              onSelect={(camp) => {
                setLinkedValue("camp_id", camp.id);
                setLinkedValue("camp_name", camp.name);
                setLinkedValue("registration_type", "camp");
                setLinkedValue("registration_source", "camp");
                const venue = campVenueLabel(camp);
                if (venue) {
                  setLinkedValue("referred_by_facility", venue);
                }
                if (camp.organizing_department_id) {
                  setLinkedValue("department_id", camp.organizing_department_id);
                }
              }}
              onClear={() => {
                setLinkedValue("camp_id", "");
              }}
            />
            <FormTextField
              control={control}
              name="camp_name"
              label="Camp name"
              placeholder="Village / school / outreach camp name"
            />
            <ReferenceMenu
              title="Referral type"
              rows={referralTypeOptions}
              selectedId={values.referred_by_kind}
              label={(row) => row.label}
              placeholder="Doctor / ASHA / camp worker"
              onSelect={(row) => {
                setLinkedValue("referred_by_kind", row.id);
                if (row.id !== "doctor") {
                  setLinkedValue("referred_by_user_id", "");
                }
              }}
            />
            <ReferenceMenu
              title="Referring doctor"
              rows={doctors.filter((doctor) => doctor.is_active)}
              selectedId={values.referred_by_user_id}
              label={doctorLabel}
              placeholder={
                values.referred_by_kind === "doctor" ? "Select doctor" : "Optional doctor link"
              }
              disabled={values.referred_by_kind !== "doctor"}
              onSelect={(doctor) => {
                setLinkedValue("referred_by_user_id", doctor.id);
                setLinkedValue("referred_by_name", doctor.full_name);
              }}
              onClear={() => {
                setLinkedValue("referred_by_user_id", "");
              }}
            />
            <FormTextField
              control={control}
              name="referred_by_name"
              label="Referred by"
              placeholder="Doctor / ASHA / camp worker"
            />
            <FormTextField
              control={control}
              name="referred_by_phone"
              label="Referred by phone"
              keyboardType="phone-pad"
            />
            <ReferenceMenu
              title="Facility reference"
              rows={facilities}
              selectedId={values.referred_by_facility_id}
              label={facilityLabel}
              placeholder={selectedCamp ? "Camp venue loaded" : "Select facility if known"}
              onSelect={(facility) => {
                setLinkedValue("referred_by_facility_id", facility.id);
                setLinkedValue("referred_by_facility", facility.name);
              }}
              onClear={() => {
                setLinkedValue("referred_by_facility_id", "");
              }}
            />
            <FormTextField
              control={control}
              name="referred_by_facility"
              label="Facility / village / NGO"
              placeholder={
                selectedReferralFacility?.name ??
                campVenueLabel(selectedCamp) ??
                selectedReferredDoctor?.specialization ??
                undefined
              }
            />
          </View>
        </Card>

        <Card eyebrow="Clinical ownership" title="Department and consultant" pattern="sky">
          <View style={{ gap: SPACING.sm }}>
            <ReferenceMenu
              title="Department"
              rows={departments}
              selectedId={values.department_id}
              label={(department) => department.name}
              placeholder="Select department"
              onSelect={(department) => {
                setLinkedValue("department_id", department.id);
                if (values.consultant_id) {
                  const doctorStillValid = doctors
                    .find((doctor) => doctor.id === values.consultant_id)
                    ?.department_ids.includes(department.id);
                  if (!doctorStillValid) {
                    setLinkedValue("consultant_id", "");
                  }
                }
              }}
              onClear={() => {
                setLinkedValue("department_id", "");
                setLinkedValue("consultant_id", "");
              }}
            />
            <ReferenceMenu
              title="Concerned consultant"
              rows={visibleDoctors}
              selectedId={values.consultant_id}
              label={doctorLabel}
              placeholder="Select concerned consultant"
              onSelect={(doctor) => setLinkedValue("consultant_id", doctor.id)}
              onClear={() => setLinkedValue("consultant_id", "")}
            />
            <FormTextField control={control} name="clinical_unit" label="Unit" />
            <FormTextField
              control={control}
              name="diagnosis_text"
              label="Provisional diagnosis"
              placeholder="Clinical impression at registration"
              multiline
            />
            <MobileTextField
              label="Search ICD-11"
              value={icd11Search}
              onChangeText={(nextSearch) => {
                setIcd11Search(nextSearch);
                if (!nextSearch.trim()) {
                  setLinkedValue("icd11_code", "");
                  setSelectedIcd11Result(null);
                }
              }}
              placeholder="Type diagnosis, e.g. fever"
            />
            <ReferenceMenu
              title="ICD-11"
              rows={icd11Rows}
              selectedId={values.icd11_code}
              label={(row) => row.label}
              placeholder={
                icd11Search.trim().length < 2
                  ? "Type at least 2 characters"
                  : icd11Loading
                    ? "Loading ICD-11 matches..."
                    : "Select ICD-11"
              }
              onSelect={(row) => {
                setLinkedValue("icd11_code", row.result.code);
                setSelectedIcd11Result(row.result);
                if (!values.diagnosis_text.trim()) {
                  setLinkedValue("diagnosis_text", row.result.display);
                }
              }}
              onClear={() => {
                setLinkedValue("icd11_code", "");
                setSelectedIcd11Result(null);
              }}
            />
          </View>
        </Card>

        <Card
          eyebrow="Safety flags"
          title="MLC / VIP"
          pattern={values.is_medico_legal ? "alert" : "copper"}
        >
          <View style={{ gap: SPACING.sm }}>
            <Controller
              control={control}
              name="is_medico_legal"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value ? "mlc" : "routine"}
                  onValueChange={(value) => field.onChange(value === "mlc")}
                  buttons={[
                    { value: "routine", label: "Routine" },
                    { value: "mlc", label: "MLC" },
                  ]}
                />
              )}
            />
            <FormTextField
              control={control}
              name="mlc_number"
              label="MLC number"
              disabled={!values.is_medico_legal}
            />
            <Controller
              control={control}
              name="is_vip"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value ? "vip" : "standard"}
                  onValueChange={(value) => field.onChange(value === "vip")}
                  buttons={[
                    { value: "standard", label: "Standard" },
                    { value: "vip", label: "VIP" },
                  ]}
                />
              )}
            />
          </View>
        </Card>

        {error && (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        )}
        <Button
          mode="contained"
          loading={busy}
          disabled={!isValid || busy}
          onPress={() => void submit()}
        >
          Register patient
        </Button>
        <Button mode="outlined" onPress={router.pop} disabled={busy}>
          Cancel
        </Button>
      </FormScrollView>
    </View>
  );
}

function FormTextField({
  control,
  name,
  label,
  ...props
}: {
  control: Control<MobileStaffPatientRegistrationFormInput>;
  name: FieldPath<MobileStaffPatientRegistrationFormInput>;
} & Omit<ComponentProps<typeof MobileTextField>, "value" | "onChangeText">): ReactNode {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MobileTextField
          {...props}
          label={label}
          value={typeof field.value === "string" ? field.value : ""}
          onBlur={field.onBlur}
          onChangeText={field.onChange}
          errorText={fieldState.error?.message}
        />
      )}
    />
  );
}

function campVenueLabel(camp: Camp | undefined): string | undefined {
  if (!camp) return undefined;
  const parts = [camp.venue_name, camp.venue_city, camp.venue_state, camp.venue_pincode].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function campLabel(camp: Camp): string {
  const date = camp.scheduled_date.slice(0, 10);
  return [camp.camp_code, camp.name, date].filter(Boolean).join(" - ");
}

function doctorLabel(doctor: SetupUser): string {
  return [doctor.full_name, doctor.specialization, doctor.medical_registration_number]
    .filter(Boolean)
    .join(" - ");
}

function facilityLabel(facility: Facility): string {
  return [facility.name, facility.city].filter(Boolean).join(" - ");
}

function estimateDobFromAge(value: string): string | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  const today = new Date();
  return `${today.getFullYear() - parsed}-01-01`;
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
