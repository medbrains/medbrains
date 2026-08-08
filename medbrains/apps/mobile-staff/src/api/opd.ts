/**
 * OPD API methods consumed by the doctor / reception modules.
 * Wire shape mirrors `crates/medbrains-server/src/routes/opd.rs`.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface QueueEntry {
  id: string;
  encounter_id: string;
  department_id: string;
  doctor_id: string | null;
  token_number: number;
  status: string;
  queue_date: string;
  called_at: string | null;
  completed_at: string | null;
  patient_id: string;
  patient_name: string;
  uhid: string;
}

export interface QueueTransitionResponse {
  id: string;
  encounter_id: string;
  department_id: string;
  doctor_id: string | null;
  token_number: number;
  status: string;
  queue_date: string;
  called_at: string | null;
  completed_at: string | null;
}

export interface ListQueueParams {
  date?: string;
  department_id?: string;
  doctor_id?: string;
  status?: string;
}

export async function listOpdQueue(params?: ListQueueParams): Promise<QueueEntry[]> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.department_id) qs.set("department_id", params.department_id);
  if (params?.doctor_id) qs.set("doctor_id", params.doctor_id);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<QueueEntry[]>(apiConfig, "GET", `/api/opd/queue${suffix}`);
}

export async function callQueue(id: string): Promise<QueueTransitionResponse> {
  return request<QueueTransitionResponse>(apiConfig, "PUT", `/api/opd/queue/${id}/call`);
}

export async function startConsultation(id: string): Promise<QueueTransitionResponse> {
  return request<QueueTransitionResponse>(apiConfig, "PUT", `/api/opd/queue/${id}/start`);
}

export async function completeQueueEntry(id: string): Promise<QueueTransitionResponse> {
  return request<QueueTransitionResponse>(apiConfig, "PUT", `/api/opd/queue/${id}/complete`);
}

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
