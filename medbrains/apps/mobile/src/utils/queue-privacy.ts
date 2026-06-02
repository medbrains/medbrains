import type { FieldAccessLevel, QueueEntry } from "@medbrains/types";
import { fieldAccessText, mostRestrictedFieldAccess } from "@medbrains/utils";

interface QueueIdentityAccess {
  name: FieldAccessLevel;
  uhid: FieldAccessLevel;
}

export function queuePatientNameAccess(
  firstNameAccess: FieldAccessLevel,
  middleNameAccess: FieldAccessLevel,
  lastNameAccess: FieldAccessLevel,
): FieldAccessLevel {
  return mostRestrictedFieldAccess([firstNameAccess, middleNameAccess, lastNameAccess]);
}

export function protectedQueueIdentity(item: QueueEntry, access: QueueIdentityAccess) {
  const patientName = fieldAccessText(access.name, item.patient_name, "name");
  const uhid = fieldAccessText(access.uhid, item.uhid, "identifier");

  return {
    patient_name: patientName === "—" ? "Unknown patient" : patientName,
    uhid: uhid === "—" ? "No UHID" : uhid,
  };
}
