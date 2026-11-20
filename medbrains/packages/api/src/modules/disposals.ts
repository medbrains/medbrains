/** The `/disposals` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ApproveDisposalRequest,
  CreateDisposalRequest,
  DisposalQuery,
  ExecuteDisposalRequest,
  StockDisposalItem,
  StockDisposalRequest,
  StockDisposalSummary,
} from "@medbrains/types";
import { request } from "../client.js";

export const disposalsApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: STOCK DISPOSAL
  // ══════════════════════════════════════════════════════════════

  listDisposals: (params?: DisposalQuery) => {
    const sp = new URLSearchParams();
    if (params?.store_id) sp.set("store_id", params.store_id);
    if (params?.disposal_type) sp.set("disposal_type", params.disposal_type);
    if (params?.status) sp.set("status", params.status);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<StockDisposalSummary[]>(`/disposals${qs ? `?${qs}` : ""}`);
  },

  getDisposal: (id: string) => request<StockDisposalRequest>(`/disposals/${id}`),

  getDisposalItems: (id: string) => request<StockDisposalItem[]>(`/disposals/${id}/items`),

  createDisposal: (data: CreateDisposalRequest) =>
    request<StockDisposalRequest>("/disposals", { method: "POST", body: JSON.stringify(data) }),

  approveDisposal: (id: string, data: ApproveDisposalRequest) =>
    request<StockDisposalRequest>(`/disposals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  executeDisposal: (id: string, data: ExecuteDisposalRequest) =>
    request<StockDisposalRequest>(`/disposals/${id}/execute`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
