/**
 * The consultation record behind an OPD encounter — the doctor's half of the
 * visit the receptionist opened.
 *
 * One record per encounter: `GET` returns it or 404s, `POST` creates it, `PUT`
 * amends it. The server resolves `doctor_id` from the caller and `patient_id`
 * from the encounter, so neither is sent.
 *
 * Wire shape mirrors `crates/medbrains-core/src/consultation.rs`. Only the four
 * SOAP columns are written here; the structured histories are JSONB the
 * handheld does not attempt to author.
 */

import { ApiError, request } from "./client.js";
import { apiConfig } from "./config.js";

export interface Consultation {
  id: string;
  encounter_id: string;
  doctor_id: string;
  /** Subjective. */
  chief_complaint: string | null;
  /** Objective. */
  examination: string | null;
  /** Assessment. The column is `notes`; the label a clinician reads is not. */
  notes: string | null;
  /** Plan. */
  plan: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationNotes {
  chief_complaint?: string;
  examination?: string;
  notes?: string;
  plan?: string;
}

/**
 * The consultation for an encounter, or null when none has been written.
 *
 * A 404 here means "not written yet", which is the ordinary state of every
 * encounter the moment it opens — it is not an error to show the doctor.
 * Anything else is rethrown: a 403 must not arrive on screen disguised as a
 * blank note.
 */
export async function getConsultation(encounterId: string): Promise<Consultation | null> {
  try {
    return await request<Consultation>(
      apiConfig,
      "GET",
      `/api/opd/encounters/${encounterId}/consultation`,
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function createConsultation(
  encounterId: string,
  notes: ConsultationNotes,
): Promise<Consultation> {
  return request<Consultation>(
    apiConfig,
    "POST",
    `/api/opd/encounters/${encounterId}/consultation`,
    notes,
  );
}

export async function updateConsultation(
  encounterId: string,
  consultationId: string,
  notes: ConsultationNotes,
): Promise<Consultation> {
  return request<Consultation>(
    apiConfig,
    "PUT",
    `/api/opd/encounters/${encounterId}/consultation/${consultationId}`,
    notes,
  );
}

/**
 * Narrowly 404, never "any failure".
 *
 * Widening this to a truthy check would fold a refused read into "no notes
 * yet", and the doctor would start writing a second consultation over one they
 * were not allowed to see -- an authorization fault wearing the disguise of an
 * empty record.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
