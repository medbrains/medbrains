/**
 * Nursing handover (SBAR) API. Wire shape mirrors
 * `crates/medbrains-nursing/src/nurse_handoff.rs`.
 */

import type { ActiveNurseCall, NurseCallBoard } from "@medbrains/types";
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

// ── Ward call board ────────────────────────────────────────
// Wire shape mirrors `crates/medbrains-care-mgmt/src/nurse_calls.rs`.

export type {
  ActiveNurseCall,
  NurseCallBoard,
  NurseCallEscalation,
} from "@medbrains/types";

/** Every open call in the ward — needs `bedside.calls.board`, not `bedside.view`. */
export async function listActiveNurseCalls(wardId?: string): Promise<NurseCallBoard> {
  const query = wardId ? `?ward_id=${encodeURIComponent(wardId)}` : "";
  return request<NurseCallBoard>(apiConfig, "GET", `/api/bedside/nurse-calls/active${query}`);
}

/**
 * Acknowledge, complete or cancel one call.
 *
 * `acknowledged` means seen, not answered — the server keeps the clock running
 * from `created_at`, so acknowledging does not quiet the board.
 */
export async function updateNurseCallStatus(
  id: string,
  status: "acknowledged" | "completed" | "cancelled",
): Promise<ActiveNurseCall> {
  return request<ActiveNurseCall>(apiConfig, "PUT", `/api/bedside/nurse-requests/${id}/status`, {
    status,
  });
}

/**
 * Just the rows, for the home tile.
 *
 * `useModuleCount` needs an array so a failed fetch can stay "—" rather than
 * become 0 — a tile reading "0 beds waiting" because the network dropped is
 * indistinguishable from a quiet ward, and it is the one number on this screen
 * where that difference is a patient waiting.
 */
export async function listOpenNurseCalls(wardId?: string): Promise<ActiveNurseCall[]> {
  const board = await listActiveNurseCalls(wardId);
  return board.calls;
}
