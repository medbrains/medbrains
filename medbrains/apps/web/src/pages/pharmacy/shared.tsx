// Shared pharmacy helpers — pure field-access masking + currency formatting used across many
// tabs, extracted from pharmacy.tsx so tab components can be split into their own files.
import { Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";

export function formatInr(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

export function canViewPharmacyField(access: FieldAccessLevel) {
  return access !== "hidden";
}

export function canEditPharmacyField(access: FieldAccessLevel) {
  return access === "edit";
}

export function renderPharmacySensitiveValue(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  return fieldAccessText(access, value);
}

export function renderPharmacySensitiveIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  return fieldAccessText(access, value, "identifier");
}

export function renderPharmacySensitiveShortIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  if (access === "edit" || access === "view") return value?.slice(0, 8) ?? "\u2014";
  return renderPharmacySensitiveIdentifier(access, value);
}

export function renderPharmacySensitiveNumber(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, String(value));
}

export function renderPharmacySensitiveCurrency(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, formatInr(Number(value)), "amount");
}

export function ExpiryCell({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "danger" : days < 30 ? "danger" : days < 60 ? "orange" : undefined;
  return (
    <Text size="xs" c={color} fw={days < 60 ? 600 : 400}>
      {date}
      {days >= 0 ? ` (${days}d)` : " (expired)"}
    </Text>
  );
}
