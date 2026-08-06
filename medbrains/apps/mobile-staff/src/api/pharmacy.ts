/**
 * Pharmacy API methods — Rx queue + dispensing.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

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

export interface CatalogItemRow {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  unit: string | null;
  current_stock: number;
  reorder_level: number;
  barcode: string | null;
  drug_schedule: string | null;
  is_controlled: boolean;
}

/**
 * Exact-match lookup, filtered server-side. A drug catalogue runs to thousands
 * of items, so pulling it all down to match a scan on the phone would break the
 * memory budget for the sake of one row.
 */
export async function findCatalogByBarcode(barcode: string): Promise<CatalogItemRow[]> {
  return request<CatalogItemRow[]>(
    apiConfig,
    "GET",
    `/api/pharmacy/catalog?barcode=${encodeURIComponent(barcode)}`,
  );
}

export type StockMovement = "receipt" | "issue" | "return" | "adjustment";

export interface RecordStockInput {
  catalog_item_id: string;
  transaction_type: StockMovement;
  quantity: number;
  notes?: string;
}

export async function recordStockTransaction(input: RecordStockInput): Promise<unknown> {
  return request<unknown>(apiConfig, "POST", "/api/pharmacy/stock/transactions", input);
}
