import { Grid, NumberInput, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { IconCalendarMonth } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { estimateDobFromAge } from "@/forms/patientRegistration.form";

type DateLike = Date | string | null | undefined;

/** Whole years between `dateOfBirth` and today, never below zero. */
function calculateAgeYears(dateOfBirth: Date): number {
  const today = new Date();
  let years = today.getFullYear() - dateOfBirth.getFullYear();
  const birthdayThisYear = new Date(
    today.getFullYear(),
    dateOfBirth.getMonth(),
    dateOfBirth.getDate(),
  );
  if (birthdayThisYear > today) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** The date picker hands back a Date or a `YYYY-MM-DD` string; both become a local Date, or null. */
function parseDatePickerValue(value: DateLike): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The picker's own value shape (`YYYY-MM-DD`), built from local parts so no timezone shifts the day. */
function toDatePickerValue(value: DateLike): string | null {
  const date = parseDatePickerValue(value);
  if (!date) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** One translated, pluralised part of an age ("3 months"). */
function agePart(value: number, unit: "day" | "month" | "year", t: TFunction): string {
  return t(`registrationForm.age.${unit}`, { count: value });
}

/** Today's exact age from a date of birth ("2 years 3 months"), or null for no or a future date. */
function formatAgeAsOfToday(value: DateLike, t: TFunction): string | null {
  const dateOfBirth = parseDatePickerValue(value);
  if (!dateOfBirth) {
    return null;
  }
  const today = new Date();
  const birthDate = new Date(
    dateOfBirth.getFullYear(),
    dateOfBirth.getMonth(),
    dateOfBirth.getDate(),
  );
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > currentDate) {
    return null;
  }
  let years = currentDate.getFullYear() - birthDate.getFullYear();
  let months = currentDate.getMonth() - birthDate.getMonth();
  let days = currentDate.getDate() - birthDate.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(agePart(years, "year", t));
  if (months > 0) parts.push(agePart(months, "month", t));
  if (years === 0 && days > 0) parts.push(agePart(days, "day", t));
  return parts.length > 0 ? parts.join(" ") : t("registrationForm.age.zeroDays");
}

/** The line under age and date of birth: the exact age, an estimate, or what to do next. */
function ageHintAsOfToday(
  dateOfBirth: DateLike,
  ageYears: number | undefined,
  isEstimated: boolean,
  t: TFunction,
): string {
  const exactAge = formatAgeAsOfToday(dateOfBirth, t);
  if (exactAge) {
    return isEstimated
      ? t("registrationForm.hint.ageAsOfTodayEstimated", { age: exactAge })
      : t("registrationForm.hint.ageAsOfToday", { age: exactAge });
  }
  if (typeof ageYears === "number") {
    return t("registrationForm.hint.ageEstimatedUntilDob", { age: agePart(ageYears, "year", t) });
  }
  return t("registrationForm.hint.selectDob");
}

interface RegistrationAgeFieldsProps {
  /** Whether the date of birth was estimated from a typed age. */
  dobEstimated: boolean;
  setDobEstimated: (estimated: boolean) => void;
  fieldError: (message: string | undefined) => string | undefined;
  /** Off for an unknown patient, whose age the rules do not ask for. */
  required: boolean;
}

const VALIDATE = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

/**
 * Age or date of birth: either one is enough. Typing an age estimates the date of birth; picking
 * a date fills the age. The required marker sits on Age, the field the desk usually types.
 */
export function RegistrationAgeFields({
  dobEstimated,
  setDobEstimated,
  fieldError,
  required,
}: RegistrationAgeFieldsProps) {
  const { t } = useTranslation("patients");
  const { control, setValue, formState } = useFormContext<PatientRegistrationFormInput>();
  const [ageYears, dateOfBirth] = useWatch({ control, name: ["age_years", "date_of_birth"] });
  // A DOB whose age did not sync still shows its age, so the input never silently reads 0.
  const derived = parseDatePickerValue(dateOfBirth);
  const ageShown =
    typeof ageYears === "number" ? ageYears : derived ? calculateAgeYears(derived) : "";

  /** A typed age replaces the date of birth, which it can only estimate. */
  const onAgeChange = (value: number | string) => {
    const age = typeof value === "number" ? value : undefined;
    setValue("age_years", age, VALIDATE);
    if (typeof age === "number") {
      setDobEstimated(true);
      setValue("date_of_birth", estimateDobFromAge(age), VALIDATE);
    } else if (dobEstimated) {
      setDobEstimated(false);
      setValue("date_of_birth", null, VALIDATE);
    }
  };
  /** A picked date of birth is exact, so it clears the estimated flag. */
  const onDateChange = (value: DateLike) => {
    const date = parseDatePickerValue(value);
    setDobEstimated(false);
    setValue("date_of_birth", date, VALIDATE);
    setValue("age_years", date ? calculateAgeYears(date) : undefined, VALIDATE);
  };

  return (
    <>
      <Grid.Col span={{ base: 12, sm: 3 }}>
        <NumberInput
          label={t("registrationForm.label.age")}
          withAsterisk={required}
          data-testid="field-age_years"
          placeholder={t("registrationForm.placeholder.ageYears")}
          min={0}
          max={125}
          value={ageShown}
          onChange={onAgeChange}
          error={fieldError(formState.errors.age_years?.message)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <DatePickerInput
          label={t("registrationForm.label.orDateOfBirth")}
          placeholder={t("registrationForm.placeholder.dateOfBirth")}
          valueFormat="DD MMM YYYY"
          value={toDatePickerValue(dateOfBirth)}
          onChange={onDateChange}
          error={fieldError(formState.errors.date_of_birth?.message)}
          clearable
          defaultLevel="decade"
          maxDate={new Date()}
          leftSection={<IconCalendarMonth size={16} />}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Text size="xs" c="var(--mb-warning-text)" fw={500}>
          {ageHintAsOfToday(dateOfBirth, ageYears, dobEstimated, t)}{" "}
          {t("registrationForm.hint.ageDobInstruction")}
        </Text>
      </Grid.Col>
    </>
  );
}
