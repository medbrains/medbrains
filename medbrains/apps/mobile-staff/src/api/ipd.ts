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
  /** Needed to ask who else is on duty when a dose wants a witness. */
  ward_id?: string | null;
  status: string;
  admitted_at: string;
}

interface AdmissionListResponse {
  admissions: Array<
    Omit<AdmissionRow, "bed_label"> & {
      bed_label?: string | null;
      ward_name?: string | null;
      ward_id?: string | null;
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

// ── Bedside medication administration (BCMA) ───────────────
// Wire shape mirrors `crates/medbrains-ipd/src/lib.rs`.

/**
 * The server's answer to a scan pair. `verified` is the only thing that
 * matters at the bedside; the two flags below it exist so the nurse is told
 * *which* right failed rather than "not verified".
 */
export interface BarcodeVerifyResult {
  verified: boolean;
  right_patient: boolean;
  right_drug: boolean;
  reason: string | null;
}

/**
 * Check the 5 rights against the wristband and the drug barcode.
 *
 * The comparison is entirely server-side and so is the `barcode_verified`
 * stamp — the client sends two strings it read off a camera and is told yes or
 * no. A client that could set the flag itself would be a client that could
 * skip the check.
 */
export async function verifyMarBarcode(
  marId: string,
  patientBarcode: string,
  drugBarcode: string,
): Promise<BarcodeVerifyResult> {
  return request<BarcodeVerifyResult>(apiConfig, "POST", `/api/nurse/mar/${marId}/verify-barcode`, {
    patient_barcode: patientBarcode,
    drug_barcode: drugBarcode,
  });
}

export interface WardOnDutyRow {
  nurse_user_id: string;
  nurse_name: string;
  shift_type: string;
  primary_assigned: boolean;
  is_charge: boolean;
  patient_count: number;
}

/** Who is on this ward today — the list a second-nurse witness is picked from. */
export async function wardOnDuty(wardId: string): Promise<WardOnDutyRow[]> {
  return request<WardOnDutyRow[]>(apiConfig, "GET", `/api/ipd/wards/${wardId}/on-duty`);
}
