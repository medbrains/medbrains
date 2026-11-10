/** UIP (MoHFW) or the IAP (ACVIP) recommended schedule. */
export type ImmunizationScheduleKind = "uip" | "iap";

export type ScheduledDoseState =
  | "given"
  | "not_counted"
  | "upcoming"
  | "due"
  | "overdue"
  | "age_passed";

export interface ScheduledDose {
  label: string;
  state: ScheduledDoseState;
  /** The date given, or the date due. */
  date: string;
  earliest: string | null;
  latest: string | null;
  /** Why a recorded dose did not count. */
  reason: string | null;
  dose_id: string | null;
  product_key: string;
  product_name: string;
}

export interface ScheduleSeries {
  key: string;
  name: string;
  /** Catch-up rules and contraindications. */
  note: string;
  doses: ScheduledDose[];
}

export interface UnmatchedDose {
  dose_id: string;
  given_on: string;
  vaccine_name: string;
  reason: string;
}

export interface ImmunizationScheduleView {
  kind: ImmunizationScheduleKind;
  series: ScheduleSeries[];
  unmatched: UnmatchedDose[];
}

/** `GET /patients/{id}/immunization-schedule` */
export interface PatientImmunizationSchedule {
  unavailable: string | null;
  schedule: ImmunizationScheduleView | null;
}

/** The hospital's schedule setting. */
export interface ImmunizationScheduleSetting {
  kind: ImmunizationScheduleKind;
  include_je: boolean;
  sms_reminders: boolean;
  remind_days_before: number;
}

export interface ImmunizationDueRow {
  patient_id: string;
  patient_name: string;
  uhid: string;
  phone: string | null;
  date_of_birth: string;
  series: string;
  dose: string;
  product_key: string;
  product_name: string;
  due_on: string;
  state: ScheduledDoseState;
}

/** `GET /immunizations/due-list` */
export interface ImmunizationDueList {
  setting: ImmunizationScheduleSetting;
  total: number;
  rows: ImmunizationDueRow[];
}
