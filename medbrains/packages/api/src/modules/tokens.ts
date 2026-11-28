/** The `/tokens` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BoardConfig,
  CampBoardRow,
  CampStation,
  IssueTokenInput,
  ModuleToken,
  ServiceTimeStats,
  TokenBoardMetrics,
  TokenCallSmsStatus,
  WorklistToken,
} from "@medbrains/types";
import { request } from "../client.js";

export const tokensApi = {
  getBoardConfig: (params: { module: string; scope?: string; scope_id?: string }) => {
    const sp = new URLSearchParams({ module: params.module });
    if (params.scope) sp.set("scope", params.scope);
    if (params.scope_id) sp.set("scope_id", params.scope_id);
    return request<BoardConfig>(`/tokens/board/config?${sp}`);
  },
  // ── Unified token / queue system ──
  issueToken: (input: IssueTokenInput) =>
    request<ModuleToken>("/tokens/issue", { method: "POST", body: JSON.stringify(input) }),
  /**
   * A no-show who came back. Keeps their token number, so the slip in their
   * hand and the link on their phone both keep working.
   */
  requeueToken: (id: string) => request<ModuleToken>(`/tokens/${id}/requeue`, { method: "POST" }),
  escalateTokenPriority: (id: string, data: { priority: string; reason: string }) =>
    request<ModuleToken>(`/tokens/${id}/priority`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listTokenBoard: (params: {
    module: string;
    scope?: string;
    scope_id?: string;
    /** Wall boards keep the number just called and recent misses on screen. */
    include_finished?: boolean;
  }) => {
    const qs = new URLSearchParams({ module: params.module });
    if (params.scope) qs.set("scope", params.scope);
    if (params.scope_id) qs.set("scope_id", params.scope_id);
    if (params.include_finished) qs.set("include_finished", "true");
    return request<ModuleToken[]>(`/tokens/board?${qs.toString()}`);
  },

  /** The same queue as the board, with the patients on it — clinicians only. */
  listTokenWorklist: (params: {
    module: string;
    scope?: string;
    scope_id?: string;
    include_finished?: boolean;
    /** `mine`: own patients, then the departments' unassigned; `department`: the whole departments. */
    view?: "mine" | "department";
  }) => {
    const qs = new URLSearchParams({ module: params.module });
    if (params.scope) qs.set("scope", params.scope);
    if (params.scope_id) qs.set("scope_id", params.scope_id);
    if (params.include_finished) qs.set("include_finished", "true");
    if (params.view) qs.set("view", params.view);
    return request<WorklistToken[]>(`/tokens/worklist?${qs.toString()}`);
  },

  /** The waiting count and mean wait that sit above a board. */
  tokenBoardMetrics: (params: { module: string; scope?: string; scope_id?: string }) => {
    const qs = new URLSearchParams({ module: params.module });
    if (params.scope) qs.set("scope", params.scope);
    if (params.scope_id) qs.set("scope_id", params.scope_id);
    return request<TokenBoardMetrics>(`/tokens/board/metrics?${qs.toString()}`);
  },
  getTokenCallSmsStatus: () => request<TokenCallSmsStatus>("/tokens/call-sms/status"),
  patientTokens: (patientId: string) =>
    request<ModuleToken[]>(`/tokens/by-patient?patient_id=${encodeURIComponent(patientId)}`),
  callToken: (id: string, counterLabel?: string) =>
    request<ModuleToken>(`/tokens/${id}/call`, {
      method: "POST",
      body: JSON.stringify({ counter_label: counterLabel ?? null }),
    }),
  serveToken: (id: string) => request<ModuleToken>(`/tokens/${id}/serve`, { method: "POST" }),
  completeToken: (id: string) => request<ModuleToken>(`/tokens/${id}/complete`, { method: "POST" }),
  /** Complete a camp token without sending the patient to the next station. */
  finishToken: (id: string) => request<ModuleToken>(`/tokens/${id}/finish`, { method: "POST" }),
  noShowToken: (id: string) => request<ModuleToken>(`/tokens/${id}/no-show`, { method: "POST" }),
  advanceToken: (id: string, status: string, counterLabel?: string) =>
    request<ModuleToken>(`/tokens/${id}/advance`, {
      method: "POST",
      body: JSON.stringify({ status, counter_label: counterLabel ?? null }),
    }),
  /**
   * How long this queue actually takes, learned from completed services.
   *
   * Returns nulls with a sample_count when nothing has been measured — the
   * caller must render that as "still learning", never as a number.
   */
  getServiceTimes: (params: {
    module: string;
    scope?: string;
    scope_id?: string;
    served_by?: string;
  }) => {
    const qs = new URLSearchParams({ module: params.module });
    if (params.scope) qs.set("scope", params.scope);
    if (params.scope_id) qs.set("scope_id", params.scope_id);
    if (params.served_by) qs.set("served_by", params.served_by);
    return request<ServiceTimeStats>(`/tokens/service-times?${qs.toString()}`);
  },
  callNextToken: (input: {
    module: string;
    scope?: string;
    scope_id?: string;
    counter_label?: string;
  }) =>
    request<ModuleToken | null>("/tokens/call-next", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listCampStations: () => request<CampStation[]>("/tokens/camp-stations"),

  /** Every station in one camp with its live queue and who is on duty. */
  getCampBoard: (campId: string) =>
    request<CampBoardRow[]>(`/tokens/camp-board?camp_id=${encodeURIComponent(campId)}`),
};
