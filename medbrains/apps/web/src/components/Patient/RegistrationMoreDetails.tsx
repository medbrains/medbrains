import { Grid, Select, TextInput } from "@mantine/core";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormRow, FormSection } from "@/components/ClinicalForm";
import { CountryPhoneInput, type PhoneCountryOption } from "@/components/inputs";
import { LocalNameRow } from "./LocalNameRow";

type Option = { value: string; label: string };

export interface RegistrationMoreDetailsProps {
  prefixOptions: Option[];
  bloodGroupOptions: Option[];
  secondPhone: {
    countryCode: string;
    onCountryCodeChange: (code: string) => void;
    dialOptions: readonly PhoneCountryOption[];
  };
  fieldError: (message: string | undefined) => string | undefined;
}

/** Prefix and middle name: optional parts of the name the required block leaves out. */
function PrefixMiddleNameRow({ prefixOptions }: { prefixOptions: Option[] }) {
  const { t } = useTranslation("patients");
  const { control, register } = useFormContext<PatientRegistrationFormInput>();
  return (
    <FormRow label={t("registrationForm.row.prefixMiddleName")}>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Controller
            control={control}
            name="prefix"
            render={({ field }) => (
              <Select
                aria-label={t("registrationForm.aria.prefix")}
                placeholder={t("registrationForm.placeholder.prefix")}
                data={prefixOptions}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
                searchable
                clearable
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <TextInput
            aria-label={t("registrationForm.aria.middleName")}
            placeholder={t("registrationForm.placeholder.middleName")}
            {...register("middle_name")}
          />
        </Grid.Col>
      </Grid>
    </FormRow>
  );
}

/** The name in the patient's own script, offered from the English name typed above. */
function LocalNameFormRow() {
  const { t } = useTranslation("patients");
  const { control, setValue } = useFormContext<PatientRegistrationFormInput>();
  const [first, middle, last] = useWatch({
    control,
    name: ["first_name", "middle_name", "last_name"],
  });
  return (
    <FormRow label={t("registrationForm.row.localName", "Name in own script")}>
      <Controller
        control={control}
        name="full_name_local"
        render={({ field }) => (
          <LocalNameRow
            englishName={[first, middle, last].filter(Boolean).join(" ")}
            value={field.value ?? ""}
            onChange={field.onChange}
            onUseEnglish={(name) => {
              const [firstPart, ...rest] = name.split(" ");
              setValue("first_name", firstPart ?? "", { shouldDirty: true });
              setValue("last_name", rest.join(" "), { shouldDirty: true });
            }}
          />
        )}
      />
    </FormRow>
  );
}

/**
 * Everything on step 1 the rules do not require, kept apart from the required block so the desk
 * never has to hunt for what must be filled (owner, first standalone hospital, 2026-11-17).
 */
export function RegistrationMoreDetails(props: RegistrationMoreDetailsProps) {
  const { t } = useTranslation("patients");
  const { control, formState } = useFormContext<PatientRegistrationFormInput>();
  return (
    <FormSection num="02" name={t("registrationForm.section.moreDetails")}>
      <PrefixMiddleNameRow prefixOptions={props.prefixOptions} />
      <LocalNameFormRow />
      <FormRow label={t("registrationForm.row.bloodGroup")}>
        <Controller
          control={control}
          name="blood_group"
          render={({ field }) => (
            <Select
              aria-label={t("registrationForm.aria.bloodGroup")}
              placeholder={t("options.bloodGroup.unknown")}
              data={props.bloodGroupOptions}
              value={field.value ?? null}
              onChange={(v) => field.onChange(v ?? undefined)}
              clearable
            />
          )}
        />
      </FormRow>
      <FormRow label={t("registrationForm.row.secondPhone")}>
        <Controller
          control={control}
          name="phone_secondary"
          render={({ field }) => (
            <CountryPhoneInput
              value={field.value ?? ""}
              onChange={field.onChange}
              countryCode={props.secondPhone.countryCode}
              onCountryCodeChange={props.secondPhone.onCountryCodeChange}
              countryOptions={props.secondPhone.dialOptions}
              countryAriaLabel={t("registrationForm.aria.alternatePhoneCountry")}
              numberAriaLabel={t("registrationForm.aria.alternatePhone")}
              placeholder={t("registrationForm.placeholder.alternatePhone")}
              error={props.fieldError(formState.errors.phone_secondary?.message)}
            />
          )}
        />
      </FormRow>
    </FormSection>
  );
}
