// Shared IPD page helpers — pure, cross-tab utilities extracted from ipd.tsx so
// individual tab components can be split into their own files without a cycle.
import type { BedTransferResponse, FieldAccessLevel } from "@medbrains/types";
import { useClinicalEmit } from "@/components";

import { fieldAccessText } from "@medbrains/utils";

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
