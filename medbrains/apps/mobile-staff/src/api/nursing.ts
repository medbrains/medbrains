/**
 * Nursing handover (SBAR) API. Wire shape mirrors
 * `crates/medbrains-nursing/src/nurse_handoff.rs`.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

/**
 * A carried-over item the incoming nurse must act on. Stored in the handoff's
 * `alerts` JSONB, which the backend keeps opaque.
 */
export interface HandoffAlert {
  /** `task` carries over pending work; `critical` flags the patient. */
  kind: "task" | "critical";
  note: string;
}

export interface ShiftHandoff {
  id: string;
  encounter_id: string;
  outgoing_nurse_id: string;
  incoming_nurse_id: string;
  outgoing_signed_at: string | null;
  incoming_signed_at: string | null;
  situation: string | null;
  background: string | null;
  assessment: string | null;
  recommendation: string | null;
  alerts: HandoffAlert[];
  completed_at: string | null;
  created_at: string;
}

export interface CreateHandoffPayload {
  encounter_id: string;
  incoming_nurse_id: string;
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  alerts?: HandoffAlert[];
}

export async function listHandoffs(encounterId: string): Promise<ShiftHandoff[]> {
  return request<ShiftHandoff[]>(apiConfig, "GET", `/api/nurse/handoffs/encounter/${encounterId}`);
}

export async function createHandoff(payload: CreateHandoffPayload): Promise<ShiftHandoff> {
  return request<ShiftHandoff>(apiConfig, "POST", "/api/nurse/handoffs", payload);
}

/** Only the incoming nurse can accept, and only once — the server enforces both. */
export async function acceptHandoff(id: string): Promise<ShiftHandoff> {
  return request<ShiftHandoff>(apiConfig, "PUT", `/api/nurse/handoffs/${id}/accept`);
}

/** Unaccepted handovers addressed to this nurse, newest first. */
export function pendingForNurse(handoffs: ShiftHandoff[], nurseId: string): ShiftHandoff[] {
  return handoffs.filter(
    (handoff) => handoff.incoming_nurse_id === nurseId && handoff.incoming_signed_at === null,
  );
}

/** Carried-over items still outstanding, so a shift cannot silently drop work. */
export function outstandingAlerts(handoffs: ShiftHandoff[]): HandoffAlert[] {
  const open = handoffs.filter((handoff) => handoff.completed_at === null);
  return open.flatMap((handoff) => handoff.alerts ?? []);
}
