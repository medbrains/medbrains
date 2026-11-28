/** The `/break-glass` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BreakGlassEvent,
  BreakGlassEventSummary,
  BreakGlassQuery,
  CreateBreakGlassRequest,
  EndBreakGlassRequest,
  ReviewBreakGlassRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const breakGlassApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: BREAK-GLASS
  // ══════════════════════════════════════════════════════════════

  startBreakGlass: (data: CreateBreakGlassRequest) =>
    request<BreakGlassEvent>("/break-glass", { method: "POST", body: JSON.stringify(data) }),

  listBreakGlass: (params?: BreakGlassQuery) => {
    const sp = new URLSearchParams();
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    if (params?.reviewed !== undefined) sp.set("reviewed", String(params.reviewed));
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<BreakGlassEventSummary[]>(`/break-glass${qs ? `?${qs}` : ""}`);
  },

  getBreakGlass: (id: string) => request<BreakGlassEvent>(`/break-glass/${id}`),

  endBreakGlass: (id: string, data: EndBreakGlassRequest) =>
    request<BreakGlassEvent>(`/break-glass/${id}/end`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewBreakGlass: (id: string, data: ReviewBreakGlassRequest) =>
    request<BreakGlassEvent>(`/break-glass/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
