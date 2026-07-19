// Shared OPD helpers — pure queue/appointment status + visit-type display formatters
// (label/tone/shape/icon) extracted from opd.tsx so queue cells and the appointments
// panel can be split into their own files without a cycle.

import type { AppointmentWithPatient, FieldAccessLevel, QueueEntry } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconCheck, IconClock, IconPhone, IconStethoscope, IconUserOff } from "@tabler/icons-react";
import type { useTranslation } from "react-i18next";
import type { OperationalSignalShape, OperationalSignalTone } from "@/components";
import { todayDateString } from "@/lib/date-utils";

export type OpdTranslate = ReturnType<typeof useTranslation>["t"];

export function humanizeWorkflowValue(value: string): string {
  return value.replace(/_/g, " ");
}

export function queueStatusLabel(t: OpdTranslate, status: string): string {
  return t(`queueStatus.${status}`, { defaultValue: humanizeWorkflowValue(status) });
}

export function queueStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "completed":
      return "ready";
    case "no_show":
      return "risk";
    case "called":
    case "in_consultation":
      return "active";
    case "waiting":
      return "blocked";
    default:
      return "neutral";
  }
}

export function queueStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "called":
    case "in_consultation":
    case "no_show":
      return "diamond";
    case "waiting":
      return "token";
    default:
      return "pill";
  }
}

export function queueStatusIcon(status: string) {
  switch (status) {
    case "waiting":
      return IconClock;
    case "called":
      return IconPhone;
    case "in_consultation":
      return IconStethoscope;
    case "completed":
      return IconCheck;
    case "no_show":
      return IconUserOff;
    default:
      return undefined;
  }
}

export function appointmentStatusLabel(t: OpdTranslate, status: string): string {
  return t(`appointmentStatus.${status}`, { defaultValue: humanizeWorkflowValue(status) });
}

export function appointmentStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "completed":
      return "ready";
    case "cancelled":
    case "no_show":
      return "risk";
    case "checked_in":
    case "in_consultation":
      return "active";
    case "scheduled":
    case "confirmed":
      return "blocked";
    default:
      return "neutral";
  }
}

export function appointmentStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "checked_in":
    case "in_consultation":
    case "cancelled":
    case "no_show":
      return "diamond";
    case "scheduled":
    case "confirmed":
      return "token";
    default:
      return "pill";
  }
}

export function appointmentTypeLabel(t: OpdTranslate, appointmentType: string): string {
  return t(`appointmentType.${appointmentType}`, {
    defaultValue: humanizeWorkflowValue(appointmentType),
  });
}

export function queueVisitTypeLabel(t: OpdTranslate, visitType: string): string {
  return t(`queueVisitType.${visitType}`, { defaultValue: humanizeWorkflowValue(visitType) });
}

export function queueVisitTypeTone(visitType: string): OperationalSignalTone {
  switch (visitType) {
    case "emergency":
      return "risk";
    case "camp":
    case "referral":
      return "active";
    case "booked":
    case "follow_up":
      return "blocked";
    default:
      return "neutral";
  }
}

export function queueVisitTypeShape(visitType: string): OperationalSignalShape {
  switch (visitType) {
    case "emergency":
    case "referral":
      return "diamond";
    case "booked":
    case "follow_up":
    case "camp":
      return "token";
    default:
      return "pill";
  }
}

export function todayIsoDate(): string {
  return todayDateString();
}

export function appointmentVisitType(
  appointmentType: AppointmentWithPatient["appointment_type"],
): string {
  return appointmentType === "follow_up" ? "follow_up" : "booked";
}

export function appointmentSlotLabel(
  appointment: {
    appointment_date?: string | null;
    slot_start?: string | null;
    slot_end?: string | null;
    appointment_slot_start?: string | null;
    appointment_slot_end?: string | null;
  },
  noSlotLabel = "No slot",
): string {
  const start = appointment.slot_start ?? appointment.appointment_slot_start;
  const end = appointment.slot_end ?? appointment.appointment_slot_end;
  return start && end ? `${start} - ${end}` : (appointment.appointment_date ?? noSlotLabel);
}

export function formatQueueToken(tokenNumber: number): string {
  return `T${String(tokenNumber).padStart(3, "0")}`;
}

export function protectedOpdQueueIdentity(
  entry: QueueEntry,
  access: { name: FieldAccessLevel; uhid: FieldAccessLevel },
  fallback: { patient: string; uhid: string } = { patient: "Patient", uhid: "No UHID" },
): { name: string; token: string; uhid: string } {
  const name = fieldAccessText(access.name, entry.patient_name, "name");
  const uhid = fieldAccessText(access.uhid, entry.uhid, "identifier");

  return {
    name: name === "—" ? fallback.patient : name,
    token: formatQueueToken(entry.token_number),
    uhid: uhid === "—" ? fallback.uhid : uhid,
  };
}
