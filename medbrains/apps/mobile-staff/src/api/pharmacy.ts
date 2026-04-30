/**
 * Pharmacy API methods — Rx queue + dispensing.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface PharmacyOrderRow {
  id: string;
  patient_id: string;
  status: string;
  dispensing_type: string;
  notes: string | null;
  created_at: string;
  dispensed_at: string | null;
}

export interface OrderListResponse {
  orders: PharmacyOrderRow[];
  total: number;
  page: number;
  per_page: number;
}

export async function listPharmacyOrders(status?: string): Promise<OrderListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<OrderListResponse>(apiConfig, "GET", `/api/pharmacy/orders${qs}`);
}
