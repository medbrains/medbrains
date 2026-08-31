// Shared camp helpers — registration/followup status display, protected-identity masking,
// the CampRegistrationSignals + StatCard components and option-label helpers, extracted from
// camp.tsx so the work-tab components can split into their own files without a cycle.

import { Card, Group, Text } from "@mantine/core";
import type { CampRegistration, FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconStethoscope,
  IconTransferIn,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { OperationalSignalShape, OperationalSignalTone } from "@/components";
import { OperationalSignal } from "@/components";
import type { BadgeTone } from "@/components/ui";
import type { CampWorkTabValue } from "../camp-workspace";

export type CampTranslate = ReturnType<typeof useTranslation>["t"];

export function campWorkflowLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function campRegistrationStatusLabel(t: CampTranslate, status: string): string {
  return t(`registrationStatus.${status}`, { defaultValue: campWorkflowLabel(status) });
}

export function campRegistrationStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "converted":
      return "ready";
    case "screened":
    case "referred":
      return "active";
    case "registered":
      return "blocked";
    case "no_show":
      return "risk";
    default:
      return "neutral";
  }
}

export function campRegistrationStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "registered":
      return "token";
    case "screened":
    case "referred":
    case "no_show":
      return "diamond";
    default:
      return "pill";
  }
}

export function campRegistrationStatusIcon(status: string) {
  switch (status) {
    case "registered":
      return IconUsers;
    case "screened":
      return IconStethoscope;
    case "referred":
      return IconTransferIn;
    case "converted":
      return IconCheck;
    case "no_show":
      return IconX;
    default:
      return undefined;
  }
}

export function campClinicalRouteReady(registration: CampRegistration): boolean {
  return Boolean(registration.clinical_department_id);
}

export function CampRegistrationSignals({
  registration,
  size = "xs",
}: {
  registration: CampRegistration;
  size?: "xs" | "sm";
}) {
  const { t } = useTranslation("camp");
  const routeReady = campClinicalRouteReady(registration);

  return (
    <Group gap={4} wrap="wrap">
      <OperationalSignal
        icon={campRegistrationStatusIcon(registration.status)}
        label={campRegistrationStatusLabel(t, registration.status)}
        shape={campRegistrationStatusShape(registration.status)}
        size={size}
        tone={campRegistrationStatusTone(registration.status)}
      />
      {registration.patient_id && (
        <OperationalSignal
          icon={IconUsers}
          label={t("signals.patientLinked")}
          shape="token"
          size={size}
          tone="ready"
        />
      )}
      {routeReady ? (
        <OperationalSignal
          icon={IconArrowRight}
          label={t("signals.opdReady")}
          shape="diamond"
          size={size}
          tone="active"
        />
      ) : (
        <OperationalSignal
          icon={IconClock}
          label={t("signals.routeNeeded")}
          shape="token"
          size={size}
          tone="blocked"
        />
      )}
    </Group>
  );
}

export function protectedCampParticipantName(
  personName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, personName, "name");
  return displayValue === "—" ? "Participant" : displayValue;
}

export function protectedCampPhone(
  phone: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, phone, "phone");
  return displayValue === "—" ? "No phone" : displayValue;
}

export function campRegistrationOptionLabel(
  registration: CampRegistration,
  access: { name: FieldAccessLevel; phone: FieldAccessLevel },
): string {
  return [
    registration.registration_number,
    protectedCampParticipantName(registration.person_name, access.name),
    registration.status,
    registration.phone ? protectedCampPhone(registration.phone, access.phone) : undefined,
  ]
    .filter(Boolean)
    .join(" - ");
}

export function StatCard({
  label,
  value,
  prefix,
}: {
  label: string;
  value: number;
  prefix?: string;
}) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700}>
        {prefix}
        {value}
      </Text>
    </Card>
  );
}

export const CAMP_STATUS_COLORS: Record<string, BadgeTone> = {
  planned: "neutral",
  approved: "primary",
  setup: "primary",
  active: "success",
  completed: "success",
  cancelled: "danger",
};

export const patientContextQuery = (patientId: string) =>
  patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";

export const campLandingPath = (patientId: string) =>
  `/camp${patientContextQuery(patientId)}#camps`;

export const campWorkPath = (
  campId: string,
  patientId: string,
  tab: CampWorkTabValue = "registrations",
) => `/camp/${campId}/work${patientContextQuery(patientId)}#${tab}`;

export const campRegistrationCreatePath = (campId: string, patientId: string) =>
  `/camp/${campId}/work/registrations/new${patientContextQuery(patientId)}`;

export const campScreeningCreatePath = (
  campId: string,
  registrationId: string,
  patientId: string,
) => {
  const query = patientContextQuery(patientId);
  const join = query ? "&" : "?";
  return `/camp/${campId}/work/screenings/new${query}${join}registration_id=${registrationId}`;
};

export const campClinicalRoutePath = (campId: string, registrationId: string, patientId: string) =>
  `/camp/${campId}/work/registrations/${registrationId}/clinical-route${patientContextQuery(
    patientId,
  )}#screenings`;

/** The services a camp offers, as offered at the registration desk. */
export const CAMP_SERVICE_LINE_OPTIONS = [
  { value: "opinion", label: "Opinion / specialist review" },
  { value: "consultation", label: "Consultation" },
  { value: "xray", label: "X-ray / imaging" },
  { value: "lab", label: "Lab test" },
  { value: "procedure", label: "Procedure" },
  { value: "pharmacy", label: "Pharmacy / medicines" },
  { value: "emergency", label: "Emergency" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];
