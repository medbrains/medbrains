/** The `/materials` API area. Moved from `client.ts`; one module per first path segment. */
import type { InventoryItem, MaterialsAnalytics, Requisition } from "@medbrains/types";
import { request } from "../client.js";

export const materialsApi = {
  listRequisitions: (params?: { kind?: string; state?: string }) => {
    const sp = new URLSearchParams();
    if (params?.kind) sp.set("kind", params.kind);
    if (params?.state) sp.set("state", params.state);
    const qs = sp.toString();
    return request<Requisition[]>(`/materials/requisitions${qs ? `?${qs}` : ""}`);
  },
  listInventory: (params?: { kind?: string; state?: string }) => {
    const sp = new URLSearchParams();
    if (params?.kind) sp.set("kind", params.kind);
    if (params?.state) sp.set("state", params.state);
    const qs = sp.toString();
    return request<InventoryItem[]>(`/materials/inventory${qs ? `?${qs}` : ""}`);
  },
  getMaterialsAnalytics: () => request<MaterialsAnalytics>("/materials/analytics"),
};
