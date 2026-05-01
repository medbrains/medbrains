/**
 * IPD API methods consumed by the nurse module. Wire shape mirrors
 * `crates/medbrains-server/src/routes/ipd.rs`.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface MarRow {
  id: string;
  admission_id: string;
  drug_name: string;
  dose: string;
  route: string;
  frequency: string | null;
  scheduled_at: string;
  administered_at: string | null;
  status:
    | "scheduled"
    | "given"
    | "missed"
    | "refused"
    | "held"
    | "prn"
    | "discontinued";
  is_high_alert: boolean;
  barcode_verified: boolean;
  hold_reason: string | null;
}

export async function listMar(admissionId: string): Promise<MarRow[]> {
  return request<MarRow[]>(
    apiConfig,
    "GET",
    `/api/ipd/admissions/${admissionId}/mar`,
  );
}

export type MarStatus = MarRow["status"];

export interface UpdateMarPayload {
  status: MarStatus;
  administered_at?: string;
  witnessed_by?: string;
  barcode_verified?: boolean;
  hold_reason?: string;
  refused_reason?: string;
  notes?: string;
}

export async function updateMar(
  admissionId: string,
  marId: string,
  payload: UpdateMarPayload,
): Promise<MarRow> {
  return request<MarRow>(
    apiConfig,
    "PUT",
    `/api/ipd/admissions/${admissionId}/mar/${marId}`,
    payload,
  );
}

export interface AdmissionRow {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  bed_label: string | null;
  admitted_at: string;
}

export async function listActiveAdmissions(): Promise<AdmissionRow[]> {
  return request<AdmissionRow[]>(apiConfig, "GET", "/api/ipd/admissions?status=active");
}
