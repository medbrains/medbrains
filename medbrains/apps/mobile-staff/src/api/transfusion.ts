/**
 * The bedside transfusion chart.
 *
 * Not the blood bank's issue register — that is `blood-bank.ts` and a
 * different table. This is the unit hanging on the pole: who checked the
 * patient against the bag, and the observations that follow.
 *
 * Wire shape mirrors `crates/medbrains-blood-bank/src/bedside_transfusion.rs`.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface BedsideTransfusion {
  id: string;
  admission_id: string | null;
  transfusion_date: string | null;
  product_type: string | null;
  bag_number: string | null;
  blood_group: string | null;
  rh_factor: string | null;
  volume_ml: number | null;
  expiry_date: string | null;
  crossmatch_compatible: boolean | null;
  patient_verified_by_id: string | null;
  product_verified_by_id: string | null;
  consent_on_file: boolean | null;
  transfusion_start_time: string | null;
  transfusion_end_time: string | null;
  total_volume_infused_ml: number | null;
  adverse_reaction: boolean;
  reaction_type: string | null;
}

export interface StartTransfusionPayload {
  product_type: string;
  bag_number: string;
  blood_group: string;
  rh_factor?: string;
  volume_ml?: number;
  expiry_date: string;
  crossmatch_compatible: boolean;
  consent_on_file: boolean;
  /** The second nurse who checked the patient against the bag. */
  product_verified_by_id: string;
}

/**
 * The four points a transfusion is charted at.
 *
 * `fifteen_min` is the one that matters most: an acute haemolytic reaction
 * declares itself in the first quarter of an hour, which is why the phase has
 * its own name rather than being the first of the periodic set.
 */
export const TRANSFUSION_PHASES = ["baseline", "fifteen_min", "periodic", "completion"] as const;

export type TransfusionPhase = (typeof TRANSFUSION_PHASES)[number];

export interface TransfusionObservation {
  id: string;
  transfusion_id: string;
  phase: string;
  temperature_c: number | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  adverse_signs: boolean;
  /**
   * Server-computed, never sent. A temperature at or above 38 C, or signs the
   * nurse ticked, and the server decides — a client that could set this could
   * also record a febrile patient as unremarkable.
   */
  reaction_suspected: boolean;
  notes: string | null;
  observed_at: string;
}

export interface RecordObservationPayload {
  phase: TransfusionPhase;
  temperature_c?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  adverse_signs: boolean;
  notes?: string;
}

export async function listBedsideTransfusions(admissionId: string): Promise<BedsideTransfusion[]> {
  return request<BedsideTransfusion[]>(
    apiConfig,
    "GET",
    `/api/ipd/admissions/${admissionId}/transfusions`,
  );
}

export async function startBedsideTransfusion(
  admissionId: string,
  payload: StartTransfusionPayload,
): Promise<BedsideTransfusion> {
  return request<BedsideTransfusion>(
    apiConfig,
    "POST",
    `/api/ipd/admissions/${admissionId}/transfusions`,
    payload,
  );
}

export async function completeBedsideTransfusion(
  id: string,
  totalVolumeInfusedMl?: number,
): Promise<BedsideTransfusion> {
  return request<BedsideTransfusion>(apiConfig, "PUT", `/api/ipd/transfusions/${id}/complete`, {
    total_volume_infused_ml: totalVolumeInfusedMl,
  });
}

export async function listTransfusionObservations(
  transfusionId: string,
): Promise<TransfusionObservation[]> {
  return request<TransfusionObservation[]>(
    apiConfig,
    "GET",
    `/api/blood-bank/transfusions/${transfusionId}/observations`,
  );
}

export async function recordTransfusionObservation(
  transfusionId: string,
  payload: RecordObservationPayload,
): Promise<TransfusionObservation> {
  return request<TransfusionObservation>(
    apiConfig,
    "POST",
    `/api/blood-bank/transfusions/${transfusionId}/observations`,
    payload,
  );
}
