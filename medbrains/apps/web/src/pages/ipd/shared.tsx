// Shared IPD page helpers — pure, cross-tab utilities extracted from ipd.tsx so
// individual tab components can be split into their own files without a cycle.

import type { BedTransferResponse, FieldAccessLevel } from "@medbrains/types";
import {
  bedBoardSignalLabel,
  bedBoardSignalLabelKey,
  bedBoardStatusLabel,
  bedBoardStatusLabelKey,
  bedBoardStatusSignal,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBed,
  IconCalendarTime,
  IconCheck,
  IconDoor,
  IconUserOff,
} from "@tabler/icons-react";
import type { useTranslation } from "react-i18next";
import type { OperationalSignalShape, OperationalSignalTone, useClinicalEmit } from "@/components";
import type { BadgeTone } from "@/components/ui";

export function protectedIpdPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

export function protectedIpdPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

export function emitIpdBedMovementEvent(
  emit: ReturnType<typeof useClinicalEmit>,
  response: BedTransferResponse,
  patientId: string,
  notes?: string,
) {
  if (response.from_bed_id) {
    emit("bed.transferred", {
      admission_id: response.admission_id,
      from_bed_id: response.from_bed_id,
      notes,
      patient_id: patientId,
      reason: response.reason,
      source_record_id: response.transfer_id,
      to_bed_id: response.to_bed_id,
      transfer_id: response.transfer_id,
      transfer_type: response.transfer_type,
    });
    return;
  }

  emit("bed.assigned", {
    admission_id: response.admission_id,
    bed_id: response.to_bed_id,
    notes,
    patient_id: patientId,
    reason: response.reason,
    source_record_id: response.transfer_id,
    transfer_id: response.transfer_id,
  });
}

export const bedStatusColors: Record<string, string> = {
  vacant_clean: "success",
  vacant_dirty: "warning",
  occupied: "primary",
  occupied_transfer_pending: "orange",
  reserved: "orange",
  maintenance: "slate",
  blocked: "danger",
};

export const bedStatusBadgeTones: Record<string, BadgeTone> = {
  vacant_clean: "success",
  vacant_dirty: "warning",
  occupied: "primary",
  occupied_transfer_pending: "warning",
  reserved: "warning",
  maintenance: "neutral",
  blocked: "danger",
};

type IpdTranslate = ReturnType<typeof useTranslation>["t"];

export function translatedBedDashboardLabel(
  t: IpdTranslate,
  key: string | null,
  fallback: string,
): string {
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

export function bedDashboardStatusLabel(t: IpdTranslate, status: string): string {
  return translatedBedDashboardLabel(
    t,
    bedBoardStatusLabelKey(status),
    bedBoardStatusLabel(status),
  );
}

export function bedDashboardSignalLabel(t: IpdTranslate, status: string): string {
  return translatedBedDashboardLabel(
    t,
    bedBoardSignalLabelKey(status),
    bedBoardSignalLabel(status),
  );
}

export function bedDashboardStatusTone(status: string): OperationalSignalTone {
  return bedBoardStatusSignal(status).tone;
}

export function bedDashboardStatusShape(status: string): OperationalSignalShape {
  return bedBoardStatusSignal(status).shape;
}

export function bedDashboardStatusIcon(status: string) {
  switch (status) {
    case "vacant_clean":
      return IconCheck;
    case "vacant_dirty":
      return IconDoor;
    case "occupied":
      return IconBed;
    case "occupied_transfer_pending":
      return IconArrowRight;
    case "reserved":
      return IconCalendarTime;
    case "maintenance":
      return IconAlertTriangle;
    case "blocked":
      return IconUserOff;
    default:
      return undefined;
  }
}
