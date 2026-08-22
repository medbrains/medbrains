/**
 * OPD API methods consumed by the doctor / reception modules.
 * Wire shape mirrors `crates/medbrains-server/src/routes/opd.rs`.
 *
 * The queue lives in `api/queue.ts` now. The `opd_queues` calls that used to be
 * here -- list, call, start, complete -- were a second queue nobody else read,
 * and are deleted rather than left for someone to reach for.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_name: string | null;
  doctor_id: string;
  appointment_date: string;
  start_time: string | null;
  status: string;
  reason: string | null;
}

/**
 * A doctor's own list for a day. `doctor_id` is passed from the signed-in
 * identity rather than chosen — a doctor looking at their phone between rounds
 * wants their own clinic, and there is no reason for the app to offer anyone
 * else's.
 */
export async function listMyAppointments(
  doctorId: string,
  date: string,
): Promise<AppointmentRow[]> {
  const qs = new URLSearchParams({ doctor_id: doctorId, date });
  return request<AppointmentRow[]>(apiConfig, "GET", `/api/opd/appointments?${qs}`);
}

// ── Starting an OPD visit ──────────────────────────────────
// Wire shape mirrors `crates/medbrains-opd/src/lib.rs`.

export interface StartVisitPayload {
  patient_id: string;
  department_id: string;
  doctor_id?: string;
  chief_complaint?: string;
  visit_type?: string;
}

export interface StartedVisit {
  encounter: {
    id: string;
    patient_id: string;
    department_id: string | null;
    doctor_id: string | null;
    status: string;
    encounter_date: string;
  };
  queue: {
    id: string;
    token_number: number;
    status: string;
    queue_date: string;
  };
}

/**
 * Register a walk-in for OPD: opens the encounter, puts them in the clinic's
 * queue and issues the token the boards read.
 *
 * One call, because at a desk it is one act. The three records it writes are
 * an implementation detail of the hospital, not a sequence a receptionist
 * should have to complete by hand while somebody waits.
 */
export async function startOpdVisit(payload: StartVisitPayload): Promise<StartedVisit> {
  return request<StartedVisit>(apiConfig, "POST", "/api/opd/encounters", payload);
}
