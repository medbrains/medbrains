/**
 * Patients API methods consumed by the reception module. Wire shape
 * mirrors `crates/medbrains-server/src/routes/patients.rs`.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface PatientRow {
  id: string;
  uhid: string;
  prefix: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string;
  phone: string | null;
  registration_type: string;
  is_active: boolean;
}

export interface PatientListResponse {
  patients: PatientRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface ListPatientsParams {
  page?: number;
  per_page?: number;
  search?: string;
  category?: string;
}

export async function listPatients(
  params?: ListPatientsParams,
): Promise<PatientListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  if (params?.search) qs.set("search", params.search);
  if (params?.category) qs.set("category", params.category);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<PatientListResponse>(apiConfig, "GET", `/api/patients${suffix}`);
}

export interface CreatePatientPayload {
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "other";
  phone?: string;
  date_of_birth?: string;
  registration_type?: "self_paid" | "insurance" | "corporate" | "scheme" | "other";
}

export async function createPatient(
  payload: CreatePatientPayload,
): Promise<PatientRow> {
  return request<PatientRow>(apiConfig, "POST", "/api/patients", payload);
}
