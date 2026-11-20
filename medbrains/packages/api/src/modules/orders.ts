/** The `/orders` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CheckBasketRequest,
  CheckBasketResponse,
  OrderBasketDraft,
  SaveBasketDraftRequest,
  SignBasketRequest,
  SignBasketResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const ordersApi = {
  // ── Order Basket ──────────────────────────────────────────
  checkBasket: (data: CheckBasketRequest) =>
    request<CheckBasketResponse>("/orders/basket/check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  signBasket: (data: SignBasketRequest) =>
    request<SignBasketResponse>("/orders/basket/sign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getBasketDraft: (encounterId: string) =>
    request<OrderBasketDraft | null>(`/orders/basket/drafts/${encodeURIComponent(encounterId)}`),
  saveBasketDraft: (encounterId: string, data: SaveBasketDraftRequest) =>
    request<OrderBasketDraft>(`/orders/basket/drafts/${encodeURIComponent(encounterId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBasketDraft: (encounterId: string) =>
    request<{ deleted: boolean }>(`/orders/basket/drafts/${encodeURIComponent(encounterId)}`, {
      method: "DELETE",
    }),
  previewBasketCost: (data: { items: unknown[] }) =>
    request<{
      lines: Array<{
        item_index: number;
        kind: string;
        label: string;
        unit_price: string;
        quantity: string;
        line_total: string;
        source: string;
      }>;
      subtotal: string;
      estimated_tax: string;
      estimated_total: string;
      preauth_threshold: string;
      exceeds_preauth: boolean;
    }>("/orders/basket/preview-cost", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  carryForwardBasket: (patientId: string, excludeEncounterId?: string) => {
    const qs = excludeEncounterId
      ? `?exclude_encounter_id=${encodeURIComponent(excludeEncounterId)}`
      : "";
    return request<
      Array<{
        kind: string;
        label: string;
        source_encounter_id: string;
        source_order_id: string;
        created_at: string;
        item: unknown;
      }>
    >(`/orders/basket/previous/${encodeURIComponent(patientId)}${qs}`);
  },
};
