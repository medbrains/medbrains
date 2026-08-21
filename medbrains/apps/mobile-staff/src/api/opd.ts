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
