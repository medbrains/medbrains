import { Checkbox, Grid, Input, Select, TextInput } from "@mantine/core";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormRow, FormSection } from "@/components/ClinicalForm";
import { CountryPhoneInput, type PhoneCountryOption } from "@/components/inputs";
import { RegistrationAgeFields } from "./RegistrationAgeFields";
import { RegistrationDepartmentCol } from "./RegistrationDepartmentCol";

type Option = { value: string; label: string };
type FieldError = (message: string | undefined) => string | undefined;

export interface RegistrationRequiredFieldsProps {
  genderOptions: Option[];
  departmentOptions: Option[];
  /** Shown on the department picker when its look-up failed. */
  departmentsUnavailable?: string;
  consultantOptions: Option[];
  phone: {
    countryCode: string;
    onCountryCodeChange: (code: string) => void;
    dialOptions: readonly PhoneCountryOption[];
  };
  dobEstimated: boolean;
  setDobEstimated: (estimated: boolean) => void;
  fieldError: FieldError;
  /** The "send to OPD queue" toggle is offered (new registration, OPD visit allowed). */
  showOpdToggle: boolean;
  canWorkOpdVisit: boolean;
}

/** The unknown-patient tick: it waives the name, sex, age and phone, so it sits above them. */
function UnknownPatientRow() {
  const { t } = useTranslation("patients");
  const { control, clearErrors } = useFormContext<PatientRegistrationFormInput>();
  return (
    <FormRow label={t("registrationForm.row.unknownPatient")}>
      <Controller
        control={control}
        name="is_unknown_patient"
        render={({ field }) => (
          <Checkbox
            aria-label={t("registrationForm.aria.unknownPatient")}
            label={t("registrationForm.label.unknownPatientSkipName")}
            description={t("registrationForm.hint.unknownPatient")}
            checked={field.value ?? false}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              field.onChange(checked);
              if (checked) clearErrors(["first_name", "last_name"]);
            }}
          />
        )}
      />
    </FormRow>
  );
}

/** First and last name; only the first is required by the registration rules. */
function NameRow({ fieldError, required }: { fieldError: FieldError; required: boolean }) {
  const { t } = useTranslation("patients");
  const { register, formState } = useFormContext<PatientRegistrationFormInput>();
  return (
    <FormRow label={t("registrationForm.row.name")}>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label={t("registrationForm.label.firstName")}
            withAsterisk={required}
            data-testid="field-first_name"
            placeholder={t("registrationForm.placeholder.firstName")}
            error={fieldError(formState.errors.first_name?.message)}
            {...register("first_name")}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label={t("registrationForm.label.lastName")}
            data-testid="field-last_name"
            placeholder={t("registrationForm.placeholder.lastName")}
            error={fieldError(formState.errors.last_name?.message)}
            {...register("last_name")}
          />
        </Grid.Col>
      </Grid>
    </FormRow>
  );
}

/** Sex beside age (or date of birth), the two facts every registration needs next. */
function SexAgeRow(props: RegistrationRequiredFieldsProps & { required: boolean }) {
  const { t } = useTranslation("patients");
  const { control, formState } = useFormContext<PatientRegistrationFormInput>();
  return (
    <FormRow label={t("registrationForm.row.sexAge")}>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 5 }}>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select
                label={t("registrationForm.label.sex")}
                withAsterisk={props.required}
                data-testid="picker-gender"
                data={props.genderOptions}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                error={props.fieldError(formState.errors.gender?.message)}
              />
            )}
          />
        </Grid.Col>
        <RegistrationAgeFields
          dobEstimated={props.dobEstimated}
          setDobEstimated={props.setDobEstimated}
          fieldError={props.fieldError}
          required={props.required}
        />
      </Grid>
    </FormRow>
  );
}

/** The patient's phone and the "no phone" tick that waives it. */
function PhoneRow(props: RegistrationRequiredFieldsProps & { required: boolean }) {
  const { t } = useTranslation("patients");
  const { control, formState } = useFormContext<PatientRegistrationFormInput>();
  const hasNoPhone = useWatch({ control, name: "has_no_phone" }) ?? false;
  return (
    <FormRow label={t("registrationForm.row.phone")}>
      <Input.Wrapper
        label={t("registrationForm.label.phone")}
        withAsterisk={props.required && !hasNoPhone}
        labelElement="div"
      >
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <CountryPhoneInput
              value={field.value ?? ""}
              onChange={field.onChange}
              countryCode={props.phone.countryCode}
              onCountryCodeChange={props.phone.onCountryCodeChange}
              countryOptions={props.phone.dialOptions}
              countryAriaLabel={t("registrationForm.aria.primaryPhoneCountry")}
              numberAriaLabel={t("registrationForm.aria.primaryPhone")}
              numberTestId="field-phone"
              placeholder={t("registrationForm.placeholder.primaryPhone")}
              error={props.fieldError(formState.errors.phone?.message)}
            />
          )}
        />
      </Input.Wrapper>
      <Controller
        control={control}
        name="has_no_phone"
        render={({ field }) => (
          <Checkbox
            mt="xs"
            checked={field.value ?? false}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
            label={t("registrationForm.row.hasNoPhone")}
            description={t("registrationForm.hint.hasNoPhone")}
            data-testid="field-has_no_phone"
          />
        )}
      />
    </FormRow>
  );
}

/** The OPD hand-off: send to the queue (and open it), which makes the department required. */
function OpdToggles({ canWorkOpdVisit }: { canWorkOpdVisit: boolean }) {
  const { t } = useTranslation("patients");
  const { control, setValue } = useFormContext<PatientRegistrationFormInput>();
  const createOpdVisit = useWatch({ control, name: "create_opd_visit" });
  return (
    <Grid.Col span={12}>
      <Controller
        control={control}
        name="create_opd_visit"
        render={({ field }) => (
          <Checkbox
            aria-label={t("registrationForm.aria.sendToOpdQueue")}
            label={t("registrationForm.label.sendToOpdQueue")}
            checked={field.value ?? false}
            onChange={(event) => {
              field.onChange(event.currentTarget.checked);
              if (!event.currentTarget.checked) {
                setValue("open_opd_after_registration", false, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
            }}
          />
        )}
      />
      {canWorkOpdVisit && (
        <Controller
          control={control}
          name="open_opd_after_registration"
          render={({ field }) => (
            <Checkbox
              mt="xs"
              aria-label={t("registrationForm.aria.openOpdAfterRegistration")}
              label={t("registrationForm.label.openOpdAfterQueue")}
              checked={(field.value ?? false) && Boolean(createOpdVisit)}
              disabled={!createOpdVisit}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          )}
        />
      )}
    </Grid.Col>
  );
}

/** Department (hidden in a one-department hospital) and doctor, then the OPD hand-off. */
function VisitRow(props: RegistrationRequiredFieldsProps) {
  const { t } = useTranslation("patients");
  const { control, formState } = useFormContext<PatientRegistrationFormInput>();
  const createOpdVisit = useWatch({ control, name: "create_opd_visit" }) ?? false;
  return (
    <FormRow label={t("registrationForm.row.visit")}>
      <Grid>
        <RegistrationDepartmentCol
          control={control}
          options={props.departmentOptions}
          error={props.fieldError(formState.errors.department_id?.message)}
          unavailable={props.departmentsUnavailable}
          required={createOpdVisit}
        />
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Controller
            control={control}
            name="consultant_id"
            render={({ field }) => (
              <Select
                label={t("registrationForm.label.doctor")}
                data-testid="picker-consultant"
                placeholder={t("registrationForm.placeholder.concernedConsultant")}
                data={props.consultantOptions}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
                searchable
                clearable
              />
            )}
          />
        </Grid.Col>
        {props.showOpdToggle && <OpdToggles canWorkOpdVisit={props.canWorkOpdVisit} />}
      </Grid>
    </FormRow>
  );
}

/**
 * Step 1's required fields, together and in typing order (owner, first standalone hospital, 2026-11-17):
 * name, sex and age, phone, then the visit. Each required field carries its own marker, and the
 * markers drop for an unknown patient, whom the rules do not ask for them. DOM order is tab order.
 */
export function RegistrationRequiredFields(props: RegistrationRequiredFieldsProps) {
  const { t } = useTranslation("patients");
  const { control } = useFormContext<PatientRegistrationFormInput>();
  const required = !(useWatch({ control, name: "is_unknown_patient" }) ?? false);
  return (
    <FormSection num="01" name={t("registrationForm.section.requiredDetails")}>
      <UnknownPatientRow />
      <NameRow fieldError={props.fieldError} required={required} />
      <SexAgeRow {...props} required={required} />
      <PhoneRow {...props} required={required} />
      <VisitRow {...props} />
    </FormSection>
  );
}
