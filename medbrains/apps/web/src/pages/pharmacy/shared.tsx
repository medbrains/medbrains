// Shared pharmacy helpers — pure field-access masking + currency formatting used across many
// tabs, extracted from pharmacy.tsx so tab components can be split into their own files.
import { Text } from "@mantine/core";
import type { FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, type BadgeTone } from "@/components/ui";

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

export const SHARED_COLOR_BADGE_TONES: Record<string, BadgeTone> = {
  success: "success",
  primary: "primary",
  danger: "danger",
  warning: "warning",
  info: "info",
  indigo: "accent",
  orange: "warning",
  yellow: "warning",
  green: "success",
  teal: "success",
  blue: "info",
  red: "danger",
  gray: "neutral",
};

export function sharedColorBadgeTone(color: string | undefined): BadgeTone {
  return (color ? SHARED_COLOR_BADGE_TONES[color] : undefined) ?? "neutral";
}

export function PharmacyRestrictedValue() {
  return (
    <Text span size="sm" c="dimmed">
      Restricted
    </Text>
  );
}

export function PharmacyPatientCell({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string | null | undefined;
  canViewPatientRecord: boolean;
}) {
  if (!patientId) {
    return (
      <Text span size="sm" c="dimmed">
        Walk-in
      </Text>
    );
  }
  if (!canViewPatientRecord) {
    return <PharmacyRestrictedValue />;
  }
  return <PatientNameCell patientId={patientId} showUhid={false} />;
}

export function PharmacyPatientContext({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string | null | undefined;
  canViewPatientRecord: boolean;
}) {
  if (!patientId) return null;
  if (!canViewPatientRecord) {
    return (
      <Alert tone="neutral" title="Patient context restricted">
        Patient identity and demographics are hidden for this pharmacy role.
      </Alert>
    );
  }
  return <PatientContextBanner patientId={patientId} hideLoadingState />;
}
