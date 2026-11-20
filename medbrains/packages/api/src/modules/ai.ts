/** The `/ai` API area. Moved from `client.ts`; one module per first path segment. */

import type {
  AiAggregatePatient,
  AiConversationMessage,
  AiConversationSummary,
} from "../client.js";
import { getCsrfToken, nativeAccessToken, nativeClientName, request } from "../client.js";
import { getApiBase } from "../config.js";

export const aiApi = {
  // AI copilot — streaming chat (SSE). Returns the raw Response so the caller
  // reads the event stream; auth/CSRF/base-URL match `request`, but SSE isn't
  // JSON so it can't use the typed helper.
  chatStream: (
    body: { message: string; conversation_id?: string; context?: unknown },
    signal?: AbortSignal,
  ): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (nativeClientName) {
      headers["X-MedBrains-Client"] = nativeClientName;
    }
    if (nativeAccessToken) {
      headers.Authorization = `Bearer ${nativeAccessToken}`;
    }
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
    return fetch(`${getApiBase()}/ai/chat`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
      signal,
    });
  },
  // Proactive whispers — a long-lived SSE of critical alerts. Raw Response so
  // the caller reads the event stream (GET → no CSRF needed).
  whisperStream: (signal?: AbortSignal): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (nativeClientName) {
      headers["X-MedBrains-Client"] = nativeClientName;
    }
    if (nativeAccessToken) {
      headers.Authorization = `Bearer ${nativeAccessToken}`;
    }
    return fetch(`${getApiBase()}/ai/whispers`, {
      method: "GET",
      headers,
      credentials: "include",
      signal,
    });
  },
  listAiConversations: () => request<AiConversationSummary[]>("/ai/conversations"),
  aiAggregatePatients: (metric: string, params: { key: string; from: string; to: string }) =>
    request<AiAggregatePatient[]>(
      `/ai/aggregate/${metric}/patients?${new URLSearchParams(params)}`,
    ),
  getAiConversationMessages: (id: string) =>
    request<AiConversationMessage[]>(`/ai/conversations/${id}/messages`),
  aiReplayWidget: (messageId: string, index: number) =>
    request<Record<string, unknown>>(`/ai/messages/${messageId}/widgets/${index}`),
};
