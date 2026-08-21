/**
 * The unified token queue — one table for the board, the console and the clinic.
 *
 * Replaces `api/opd.ts`'s `opd_queues` calls on the doctor's screens. Check-in
 * used to write three parallel queues that advanced independently: the doctor
 * called the next patient in `opd_queues` while the waiting-room board read a
 * different table nothing advanced.
 *
 * Two reads of the one queue. `/tokens/board` carries no patient name and is
 * what a screen in a corridor gets; `/tokens/worklist` carries the name, the
 * UHID and the encounter, and is gated on a clinical permission.
 *
 * Wire shape mirrors `crates/medbrains-tokens/src/lib.rs`.
 */

import type { ModuleToken, WorklistToken } from "@medbrains/types";

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export type { ModuleToken, WorklistToken } from "@medbrains/types";

export interface WorklistParams {
  module: string;
  scope?: string;
  scope_id?: string;
  include_finished?: boolean;
}

export async function listWorklist(params: WorklistParams): Promise<WorklistToken[]> {
  const qs = new URLSearchParams({ module: params.module });
  if (params.scope) qs.set("scope", params.scope);
  if (params.scope_id) qs.set("scope_id", params.scope_id);
  if (params.include_finished) qs.set("include_finished", "true");
  return request<WorklistToken[]>(apiConfig, "GET", `/api/tokens/worklist?${qs.toString()}`);
}

/** Call the patient in. `counter_label` is the room to send them to. */
export async function callToken(id: string, counterLabel?: string): Promise<ModuleToken> {
  return request<ModuleToken>(apiConfig, "POST", `/api/tokens/${id}/call`, {
    counter_label: counterLabel ?? null,
  });
}

/** They are in the room. Not the same as starting the consultation record. */
export async function serveToken(id: string): Promise<ModuleToken> {
  return request<ModuleToken>(apiConfig, "POST", `/api/tokens/${id}/serve`);
}

export async function completeToken(id: string): Promise<ModuleToken> {
  return request<ModuleToken>(apiConfig, "POST", `/api/tokens/${id}/complete`);
}

/**
 * Call whoever is next, and let the server decide who that is.
 *
 * Under an advisory lock, by priority weight then position — the same rule the
 * list arrives in. A client picking the row and calling it by id would race
 * another desk doing the same and call one patient twice.
 */
export async function callNextInQueue(
  module: string,
  scope?: { scope: string; scope_id: string },
  counterLabel?: string,
): Promise<ModuleToken | null> {
  return request<ModuleToken | null>(apiConfig, "POST", "/api/tokens/call-next", {
    counter_label: counterLabel ?? null,
    module,
    scope: scope?.scope ?? null,
    scope_id: scope?.scope_id ?? null,
  });
}

/** Nobody answered. The board keeps them visible for a while either way. */
export async function noShowToken(id: string): Promise<ModuleToken> {
  return request<ModuleToken>(apiConfig, "POST", `/api/tokens/${id}/no-show`);
}

/**
 * Today's OPD queue, for a home tile that must show a count or nothing.
 *
 * `useModuleCount` needs an array so a failed fetch stays "—" rather than
 * becoming 0: a tile reading "0 waiting" because the network dropped is
 * indistinguishable from a clinic that has seen everybody.
 */
export async function listOpdWorklistCount(): Promise<WorklistToken[]> {
  return listWorklist({ module: "opd" });
}
