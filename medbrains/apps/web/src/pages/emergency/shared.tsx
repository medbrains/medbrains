// Shared emergency helpers — pure access-masking, patient-identity, and triage/visit-status/
// resuscitation display utilities extracted from emergency.tsx so tab components can be split
// into their own files without a cycle.

import { Group, Stack, Text } from "@mantine/core";
import type { EmergencyResuscitationLogFormInput } from "@medbrains/schemas";
import type { ErResuscitationLog, ErVisit, FieldAccessLevel } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingHospital,
  IconCheck,
  IconClock,
  IconFileText,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { OperationalSignalShape, OperationalSignalTone } from "@/components";
import { OperationalSignal, useProtectedFieldAccess } from "@/components";
import type { BadgeTone } from "@/components/ui";

export type EmergencyTranslate = ReturnType<typeof useTranslation>["t"];

export function humanizeWorkflowValue(value: string): string {
  return value.replace(/_/g, " ");
}

export function canViewSensitiveField(access: FieldAccessLevel) {
  return access !== "hidden";
}

export function canEditSensitiveField(access: FieldAccessLevel) {
  return access === "edit";
}

export function RestrictedValue() {
  return (
    <Text span c="dimmed" size="sm">
      Restricted
    </Text>
  );
}

export function renderSensitiveValue(access: FieldAccessLevel, value: string | null | undefined) {
  return fieldAccessText(access, value);
}

export function useEmergencyPatientIdentityAccess() {
  return {
    name: useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS),
    uhid: useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY),
  };
}

export function protectedEmergencyPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

export function protectedEmergencyPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

export interface TriageInfo {
  color: string;
  label: string;
  level: number;
}

export function triageInfo(level: string | null): TriageInfo {
  switch (level) {
    case "immediate":
      return { color: "danger", label: "RED - Immediate", level: 1 };
    case "emergent":
      return { color: "orange", label: "ORANGE - Emergent", level: 2 };
    case "urgent":
      return { color: "warning", label: "YELLOW - Urgent", level: 3 };
    case "less_urgent":
      return { color: "success", label: "GREEN - Delayed", level: 4 };
    case "non_urgent":
      return { color: "primary", label: "BLUE - Non-Urgent", level: 5 };
    case "expectant":
      return { color: "dark", label: "BLACK - Expectant", level: 6 };
    default:
      return { color: "slate", label: "Unassigned", level: 0 };
  }
}

export function triageLabel(t: EmergencyTranslate, level: string | null): string {
  return t(`triage.${level ?? "unassigned"}`, { defaultValue: triageInfo(level).label });
}

export function triageTone(level: string | null): OperationalSignalTone {
  switch (level) {
    case "immediate":
    case "expectant":
      return "risk";
    case "emergent":
      return "active";
    case "urgent":
    case null:
      return "blocked";
    case "less_urgent":
    case "non_urgent":
      return "ready";
    default:
      return "neutral";
  }
}

export function triageShape(level: string | null): OperationalSignalShape {
  switch (level) {
    case "immediate":
    case "emergent":
    case "urgent":
    case "expectant":
      return "diamond";
    case null:
      return "token";
    default:
      return "pill";
  }
}

export function visitStatusLabel(t: EmergencyTranslate, status: string): string {
  return t(`visitStatus.${status}`, { defaultValue: humanizeWorkflowValue(status) });
}

export function visitStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "admitted":
    case "discharged":
    case "transferred":
      return "ready";
    case "in_treatment":
    case "observation":
    case "triaged":
      return "active";
    case "registered":
      return "blocked";
    case "lama":
    case "deceased":
      return "risk";
    default:
      return "neutral";
  }
}

export function visitStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "admitted":
      return "bed";
    case "lama":
    case "deceased":
    case "in_treatment":
      return "diamond";
    case "registered":
      return "token";
    default:
      return "pill";
  }
}

export function visitStatusIcon(status: string) {
  switch (status) {
    case "registered":
      return IconFileText;
    case "triaged":
      return IconHeartbeat;
    case "in_treatment":
      return IconFirstAidKit;
    case "observation":
      return IconClock;
    case "admitted":
      return IconBuildingHospital;
    case "discharged":
      return IconCheck;
    case "transferred":
      return IconArrowLeft;
    case "lama":
    case "deceased":
      return IconAlertTriangle;
    default:
      return undefined;
  }
}

export function resuscitationLogColor(logType: string): BadgeTone {
  switch (logType) {
    case "medication":
      return "accent";
    case "fluid":
      return "info";
    case "procedure":
    case "airway":
      return "warning";
    case "cpr":
    case "defibrillation":
      return "danger";
    case "vitals":
      return "success";
    default:
      return "neutral";
  }
}

export function resuscitationLogDetails(log: ErResuscitationLog): string {
  const parts = [
    log.medication_name,
    log.dose,
    log.route,
    log.fluid_name,
    log.fluid_volume_ml !== null && log.fluid_volume_ml !== undefined
      ? `${log.fluid_volume_ml} ml`
      : null,
    log.procedure_name,
  ].filter((item): item is string => Boolean(item));

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return log.procedure_notes ?? log.notes ?? "---";
}

export const emptyResuscitationLogForm: EmergencyResuscitationLogFormInput = {
  er_visit_id: "",
  log_type: "medication",
  medication_name: "",
  dose: "",
  route: "",
  fluid_name: "",
  fluid_volume_ml: "",
  procedure_name: "",
  procedure_notes: "",
  notes: "",
};

export function mlcDocumentText(content: Record<string, unknown>, key: string) {
  const value = content[key];
  return typeof value === "string" && value.trim().length > 0 ? value : "---";
}

export function mlcDocumentSensitiveText(
  access: FieldAccessLevel,
  content: Record<string, unknown>,
  key: string,
) {
  return renderSensitiveValue(access, mlcDocumentText(content, key));
}

export function mlcDocumentSensitiveBoolean(
  access: FieldAccessLevel,
  content: Record<string, unknown>,
  key: string,
) {
  if (access !== "edit" && access !== "view") {
    return renderSensitiveValue(access, "Sensitive value");
  }
  return content[key] === true ? "Yes" : "No";
}

export function VisitSummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Stack>
  );
}

export function EmergencyVisitSignals({
  size = "xs",
  visit,
}: {
  size?: "xs" | "sm";
  visit: ErVisit;
}) {
  const { t } = useTranslation("emergency");
  const info = triageInfo(visit.triage_level);

  return (
    <Group gap={4} wrap="wrap">
      <OperationalSignal
        icon={visitStatusIcon(visit.status)}
        label={visitStatusLabel(t, visit.status)}
        shape={visitStatusShape(visit.status)}
        size={size}
        tone={visitStatusTone(visit.status)}
      />
      <OperationalSignal
        icon={IconHeartbeat}
        label={triageLabel(t, visit.triage_level)}
        shape={triageShape(visit.triage_level)}
        size={size}
        tone={triageTone(visit.triage_level)}
        value={info.level > 0 ? String(info.level) : undefined}
      />
      {visit.is_mlc && (
        <OperationalSignal
          icon={IconGavel}
          label={t("signals.mlc")}
          shape="diamond"
          size={size}
          tone="risk"
        />
      )}
      {visit.is_brought_dead && (
        <OperationalSignal
          icon={IconAlertOctagon}
          label={t("signals.broughtDead")}
          shape="diamond"
          size={size}
          tone="risk"
        />
      )}
      {visit.bay_number && (
        <OperationalSignal
          label={t("signals.bay")}
          shape="token"
          size={size}
          tone="active"
          value={visit.bay_number}
        />
      )}
      {visit.admission_id && (
        <OperationalSignal
          icon={IconBuildingHospital}
          label={t("signals.ipdAdmission")}
          shape="bed"
          size={size}
          tone="ready"
        />
      )}
    </Group>
  );
}

// ── Main Page ──────────────────────────────────────────
