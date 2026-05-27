import { Group, Input, Select, Text, TextInput } from "@mantine/core";
import s from "./inputs.module.scss";

export interface PhoneCountryOption {
  value: string;
  label: string;
  country: string;
  example: string;
}

interface PhoneCountrySource {
  id: string;
  code: string;
  name: string;
  phone_code: string | null;
}

const DEFAULT_PHONE_COUNTRY_CODE = "+91";

export const phoneCountryOptions: PhoneCountryOption[] = [
  { value: "+91", label: "India", country: "IN", example: "9876543210" },
  { value: "+1", label: "US/Canada", country: "US", example: "5551234567" },
  { value: "+44", label: "UK", country: "GB", example: "7400123456" },
  { value: "+61", label: "Australia", country: "AU", example: "412345678" },
  { value: "+65", label: "Singapore", country: "SG", example: "81234567" },
  { value: "+971", label: "UAE", country: "AE", example: "501234567" },
  { value: "+966", label: "Saudi Arabia", country: "SA", example: "501234567" },
  { value: "+974", label: "Qatar", country: "QA", example: "33123456" },
  { value: "+965", label: "Kuwait", country: "KW", example: "51234567" },
  { value: "+968", label: "Oman", country: "OM", example: "91234567" },
] satisfies PhoneCountryOption[];

function sortedPhoneOptions(options: readonly PhoneCountryOption[]) {
  return [...options].sort((a, b) => b.value.length - a.value.length);
}

function getPhoneCountryOption(countryCode: string, options: readonly PhoneCountryOption[]) {
  const normalized = normalizePhoneCountryCode(countryCode) ?? DEFAULT_PHONE_COUNTRY_CODE;
  return (
    options.find((option) => option.value === normalized) ?? {
      value: normalized,
      label: `Country ${normalized}`,
      country: normalized,
      example: "Phone number",
    }
  );
}

export function normalizePhoneCountryCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export function defaultPhoneCountryCode(value: string | null | undefined): string {
  return normalizePhoneCountryCode(value) ?? DEFAULT_PHONE_COUNTRY_CODE;
}

export function detectPhoneCountryCode(
  value: string | null | undefined,
  options: readonly PhoneCountryOption[] = phoneCountryOptions,
  fallback = DEFAULT_PHONE_COUNTRY_CODE,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const knownOption = sortedPhoneOptions(options).find((option) =>
    trimmed.startsWith(option.value),
  );
  const genericCode = trimmed.match(/^\+\d{1,4}\b/)?.[0];
  return knownOption?.value ?? genericCode ?? fallback;
}

export function stripPhoneCountryCode(
  value: string | null | undefined,
  countryCode: string,
  options: readonly PhoneCountryOption[] = phoneCountryOptions,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  const detectedCountryCode =
    sortedPhoneOptions(options).find((option) => trimmed.startsWith(option.value))?.value ??
    countryCode;

  return trimmed.startsWith(detectedCountryCode)
    ? trimmed.slice(detectedCountryCode.length).replace(/^[\s-]+/, "")
    : trimmed;
}

export function formatPhoneWithCountryCode(
  value: string | null | undefined,
  countryCode: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith("+") ? trimmed : `${countryCode} ${trimmed}`;
}

export function buildPhoneCountryOptions(
  countries: readonly PhoneCountrySource[] | undefined,
  preferredCountryId?: string | null,
): PhoneCountryOption[] {
  const options = new Map<string, PhoneCountryOption>();
  for (const option of phoneCountryOptions) {
    options.set(option.value, option);
  }

  for (const country of countries ?? []) {
    const phoneCode = normalizePhoneCountryCode(country.phone_code);
    if (!phoneCode) {
      continue;
    }

    const nextOption: PhoneCountryOption = {
      value: phoneCode,
      label: country.name,
      country: country.code,
      example: "Phone number",
    };

    if (!options.has(phoneCode) || country.id === preferredCountryId) {
      options.set(phoneCode, nextOption);
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

interface CountryPhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  countryCode: string;
  onCountryCodeChange: (value: string) => void;
  countryOptions?: readonly PhoneCountryOption[];
  error?: string;
  placeholder?: string;
  countryAriaLabel: string;
  numberAriaLabel: string;
}

export function CountryPhoneInput({
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  countryOptions = phoneCountryOptions,
  error,
  placeholder,
  countryAriaLabel,
  numberAriaLabel,
}: CountryPhoneInputProps) {
  const selectedCountry = getPhoneCountryOption(countryCode, countryOptions);
  const normalizedValue = value ?? "";
  const savedValue = formatPhoneWithCountryCode(normalizedValue, selectedCountry.value);
  const selectOptions = countryOptions.some((option) => option.value === selectedCountry.value)
    ? countryOptions
    : [selectedCountry, ...countryOptions];
  const selectData = selectOptions.map((option) => ({
    value: option.value,
    label: `${option.country} ${option.value}`,
  }));

  const handleNumberChange = (nextValue: string) => {
    const pastedCountryCode = detectPhoneCountryCode(
      nextValue,
      countryOptions,
      selectedCountry.value,
    );
    if (nextValue.trim().startsWith("+")) {
      onCountryCodeChange(pastedCountryCode);
      onChange(stripPhoneCountryCode(nextValue, pastedCountryCode, countryOptions));
      return;
    }

    onChange(nextValue);
  };

  return (
    <Input.Wrapper error={error} className={s.phoneWrapper}>
      <div className={`${s.phoneShell}${error ? ` ${s.phoneError}` : ""}`}>
        <Group gap={0} wrap="nowrap" align="stretch" className={s.phoneControl}>
          <Select
            aria-label={countryAriaLabel}
            data={selectData}
            value={selectedCountry.value}
            onChange={(nextCountryCode) =>
              onCountryCodeChange(defaultPhoneCountryCode(nextCountryCode))
            }
            searchable
            comboboxProps={{ width: 240, position: "bottom-start" }}
            classNames={{ root: s.phoneCountry, input: s.phoneCountryInput }}
          />
          <TextInput
            aria-label={numberAriaLabel}
            inputMode="tel"
            placeholder={placeholder ?? selectedCountry.example}
            value={normalizedValue}
            onChange={(event) => handleNumberChange(event.currentTarget.value)}
            classNames={{ root: s.phoneNumber, input: s.phoneNumberInput }}
          />
        </Group>
        <Text size="xs" className={s.phoneHint}>
          {savedValue
            ? `Saved as ${savedValue}`
            : `${selectedCountry.label} ${selectedCountry.value}`}
        </Text>
      </div>
    </Input.Wrapper>
  );
}
