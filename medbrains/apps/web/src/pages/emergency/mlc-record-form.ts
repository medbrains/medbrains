/**
 * The examination/incident form of an MLC: values, the time rules the server
 * also enforces, and the update payload. Pure so it is tested on its own.
 */
import type { MlcCase, MlcStatus, UpdateMlcCaseRequest } from "@medbrains/types";
import dayjs from "dayjs";
import { z } from "zod";

/** Ward PC clocks drift; minutes "ahead" is not the future. Mirrors the server. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const MIN_AMENDMENT_REASON_CHARS = 10;

const CERTIFIED: readonly MlcStatus[] = ["opinion_given", "court_pending", "closed"];

/** Opinion given, in court or closed: the record has been relied on. */
export function isCertifiedMlc(status: MlcStatus): boolean {
  return CERTIFIED.includes(status);
}

/** Field-access groups, as the server classes them (`emergency.mlc.*`). */
export const MLC_RECORD_GROUPS = {
  "emergency.mlc.police_officer": [
    "police_officer_name",
    "police_officer_rank",
    "police_dd_number",
  ],
  "emergency.mlc.incident_details": ["date_time_of_incident", "place_of_incident", "weapon_used"],
  "emergency.mlc.clinical_course": [
    "condition_on_arrival",
    "treatment_given",
    "samples_handed_to",
    "patient_condition_at_discharge",
  ],
} as const;
export type MlcRecordGroup = keyof typeof MLC_RECORD_GROUPS;
type GroupedField = (typeof MLC_RECORD_GROUPS)[MlcRecordGroup][number];

/** The group a field belongs to, or none (doctor, examination time). */
export function mlcRecordGroupOf(field: keyof MlcRecordFormInput): MlcRecordGroup | null {
  for (const [group, fields] of Object.entries(MLC_RECORD_GROUPS)) {
    if ((fields as readonly string[]).includes(field)) return group as MlcRecordGroup;
  }
  return null;
}

export const mlcRecordFormSchema = z.object({
  examining_doctor_id: z.string(),
  /** Mantine DateTimePicker value: "YYYY-MM-DD HH:mm:ss" local, or "". */
  examined_at: z.string(),
  date_time_of_incident: z.string(),
  place_of_incident: z.string(),
  weapon_used: z.string(),
  police_officer_name: z.string(),
  police_officer_rank: z.string(),
  police_dd_number: z.string(),
  condition_on_arrival: z.string(),
  treatment_given: z.string(),
  samples_handed_to: z.string(),
  patient_condition_at_discharge: z.string(),
  amendment_reason: z.string(),
});
export type MlcRecordFormInput = z.infer<typeof mlcRecordFormSchema>;

const PICKER_FORMAT = "YYYY-MM-DD HH:mm:ss";
const toPicker = (iso: string | null) => (iso ? dayjs(iso).format(PICKER_FORMAT) : "");
const toIso = (picker: string) => (picker ? dayjs(picker).toISOString() : undefined);

export function mlcRecordFormValues(mlc: MlcCase): MlcRecordFormInput {
  return {
    examining_doctor_id: mlc.examining_doctor_id ?? "",
    examined_at: toPicker(mlc.examined_at),
    date_time_of_incident: toPicker(mlc.date_time_of_incident),
    place_of_incident: mlc.place_of_incident ?? "",
    weapon_used: mlc.weapon_used ?? "",
    police_officer_name: mlc.police_officer_name ?? "",
    police_officer_rank: mlc.police_officer_rank ?? "",
    police_dd_number: mlc.police_dd_number ?? "",
    condition_on_arrival: mlc.condition_on_arrival ?? "",
    treatment_given: mlc.treatment_given ?? "",
    samples_handed_to: mlc.samples_handed_to ?? "",
    patient_condition_at_discharge: mlc.patient_condition_at_discharge ?? "",
    amendment_reason: "",
  };
}

type FieldErrors = Partial<Record<keyof MlcRecordFormInput, string>>;

/** The rules a court would test — the server refuses the same. */
export function validateMlcRecord(
  values: MlcRecordFormInput,
  context: { registeredAt: string; certified: boolean; now?: Date },
): FieldErrors {
  const errors: FieldErrors = {};
  const now = (context.now ?? new Date()).getTime() + CLOCK_SKEW_MS;
  const incident = values.date_time_of_incident ? dayjs(values.date_time_of_incident) : null;
  const examined = values.examined_at ? dayjs(values.examined_at) : null;
  if (incident && incident.valueOf() > now) {
    errors.date_time_of_incident = "The incident cannot be in the future.";
  } else if (
    incident &&
    incident.valueOf() > dayjs(context.registeredAt).valueOf() + CLOCK_SKEW_MS
  ) {
    errors.date_time_of_incident = "The incident cannot be after the MLC was registered.";
  }
  if (examined && examined.valueOf() > now) {
    errors.examined_at = "The examination time cannot be in the future.";
  } else if (examined && incident && examined.isBefore(incident)) {
    errors.examined_at = "The examination cannot be before the incident.";
  }
  if (context.certified && values.amendment_reason.trim().length < MIN_AMENDMENT_REASON_CHARS) {
    errors.amendment_reason = `Say why this certified MLC is being amended (at least ${MIN_AMENDMENT_REASON_CHARS} characters).`;
  }
  return errors;
}

/** Filled fields only: blank means "not given", never "erase". A group the
 *  user may not edit is never sent — its masked value would read as a change. */
export function mlcRecordPayload(
  values: MlcRecordFormInput,
  options: { certified: boolean; editable: (group: MlcRecordGroup) => boolean },
): UpdateMlcCaseRequest {
  const payload: UpdateMlcCaseRequest = {
    examining_doctor_id: values.examining_doctor_id || undefined,
    examined_at: toIso(values.examined_at),
    amendment_reason: options.certified ? values.amendment_reason.trim() : undefined,
  };
  for (const [group, fields] of Object.entries(MLC_RECORD_GROUPS) as Array<
    [MlcRecordGroup, readonly GroupedField[]]
  >) {
    if (!options.editable(group)) continue;
    for (const field of fields) {
      if (field === "date_time_of_incident") {
        payload.date_time_of_incident = toIso(values.date_time_of_incident);
        continue;
      }
      const text = values[field].trim();
      if (text) payload[field] = text;
    }
  }
  return payload;
}
