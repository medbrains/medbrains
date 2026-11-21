// The OPD visit registration opens: its type and its queue note.

import type { CreatePatientRequest } from "@medbrains/types";

/** The OPD visit type a registration's type and source imply. */
export function registrationVisitType(req: CreatePatientRequest): string {
  if (req.registration_type === "camp" || req.registration_source === "camp") return "camp";
  if (req.registration_type === "emergency" || req.registration_source === "ambulance") {
    return "emergency";
  }
  if (req.registration_type === "referral" || req.registration_source === "referral") {
    return "referral";
  }
  if (req.registration_type === "revisit") return "follow_up";
  return "walk_in";
}

/** The queue note a visit opened at registration carries: how the patient came. */
export function registrationQueueNotes(req: CreatePatientRequest): string {
  const notes = ["Created from patient registration"];
  if (req.registration_type) notes.push(`Registration type: ${req.registration_type}`);
  if (req.registration_source) notes.push(`Source: ${req.registration_source}`);
  if (req.camp_name) notes.push(`Camp: ${req.camp_name}`);
  if (req.referred_by_name) notes.push(`Referred by: ${req.referred_by_name}`);
  if (req.initial_diagnosis_text)
    notes.push(`Provisional diagnosis: ${req.initial_diagnosis_text}`);
  return notes.join("\n");
}
