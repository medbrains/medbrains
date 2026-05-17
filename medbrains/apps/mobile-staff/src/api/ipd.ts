/**
 * IPD API methods consumed by the nurse module. Wire shape mirrors
 * `crates/medbrains-server/src/routes/ipd.rs`.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface MarRow {
  id: string;
  admission_id: string;
  drug_name: string;
  dose: string;
  route: string;
  frequency: string | null;
  scheduled_at: string;
  administered_at: string | null;
  status: "scheduled" | "given" | "missed" | "refused" | "held" | "prn" | "discontinued";
  is_high_alert: boolean;
  barcode_verified: boolean;
  hold_reason: string | null;
}

export async function listMar(admissionId: string): Promise<MarRow[]> {
  return request<MarRow[]>(apiConfig, "GET", `/api/ipd/admissions/${admissionId}/mar`);
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
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  bed_label: string | null;
  ward_name?: string | null;
  status: string;
  admitted_at: string;
}

interface AdmissionListResponse {
  admissions: Array<
    Omit<AdmissionRow, "bed_label"> & {
      bed_label?: string | null;
      ward_name?: string | null;
    }
  >;
  total: number;
  page: number;
  per_page: number;
}

export async function listActiveAdmissions(): Promise<AdmissionRow[]> {
  const response = await request<AdmissionListResponse>(
    apiConfig,
    "GET",
    "/api/ipd/admissions?status=admitted&per_page=100",
  );
  return response.admissions.map((row) => ({
    ...row,
    bed_label: row.bed_label ?? row.ward_name ?? null,
  }));
}

export interface VitalRow {
  id: string;
  encounter_id: string;
  temperature: string | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: string | null;
  height_cm: string | null;
  bmi: string | null;
  notes: string | null;
  recorded_at: string;
}

export interface CreateVitalsPayload {
  encounter_id: string;
  temperature?: string;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight_kg?: string;
  height_cm?: string;
  notes?: string;
}

export async function createVitalsReading(payload: CreateVitalsPayload): Promise<VitalRow> {
  return request<VitalRow>(apiConfig, "POST", "/api/nurse/vitals", payload);
}

export interface IoEntry {
  id: string;
  encounter_id: string;
  recorded_at: string;
  category: string;
  direction: "intake" | "output";
  volume_ml: number;
  notes: string | null;
}

export interface CreateIoEntryPayload {
  encounter_id: string;
  category: string;
  direction: "intake" | "output";
  volume_ml: number;
  notes?: string;
}

export async function createIoEntry(payload: CreateIoEntryPayload): Promise<IoEntry> {
  return request<IoEntry>(apiConfig, "POST", "/api/nurse/io-entries", payload);
}

export interface IoBalance {
  encounter_id: string;
  intake_total: number;
  output_total: number;
  balance: number;
  since: string;
}

export async function getIoBalance(encounterId: string): Promise<IoBalance> {
  return request<IoBalance>(
    apiConfig,
    "GET",
    `/api/nurse/io-entries/encounter/${encounterId}/balance?since_hours=8`,
  );
}

export interface CreatePainEntryPayload {
  encounter_id: string;
  scale: string;
  score: number;
  location?: string;
  character?: string;
  intervention_taken?: string;
  notes?: string;
}

export async function createPainEntry(payload: CreatePainEntryPayload): Promise<unknown> {
  return request(apiConfig, "POST", "/api/nurse/pain-entries", payload);
}

export interface CreateFallRiskPayload {
  encounter_id: string;
  scale: string;
  score: number;
  risk_level: string;
  interventions?: unknown[];
}

export async function createFallRisk(payload: CreateFallRiskPayload): Promise<unknown> {
  return request(apiConfig, "POST", "/api/nurse/fall-risk", payload);
}
