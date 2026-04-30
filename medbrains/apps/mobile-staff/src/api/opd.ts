/**
 * OPD API methods consumed by the doctor / reception modules.
 * Wire shape mirrors `crates/medbrains-server/src/routes/opd.rs`.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

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

export async function callQueue(id: string): Promise<QueueEntry> {
  return request<QueueEntry>(apiConfig, "POST", `/api/opd/queue/${id}/call`);
}

export async function startConsultation(id: string): Promise<QueueEntry> {
  return request<QueueEntry>(apiConfig, "POST", `/api/opd/queue/${id}/start`);
}

export async function completeQueueEntry(id: string): Promise<QueueEntry> {
  return request<QueueEntry>(apiConfig, "POST", `/api/opd/queue/${id}/complete`);
}
