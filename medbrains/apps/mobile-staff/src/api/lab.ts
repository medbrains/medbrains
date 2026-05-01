/**
 * Lab API methods — order queue + results.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface LabOrderRow {
  id: string;
  patient_id: string;
  test_id: string;
  status: string;
  priority: string;
  is_stat: boolean;
  is_outsourced: boolean;
  collected_at: string | null;
  completed_at: string | null;
  expected_tat_minutes: number | null;
  created_at: string;
}

export interface LabOrderListResponse {
  orders: LabOrderRow[];
  total: number;
  page: number;
  per_page: number;
}

export async function listLabOrders(status?: string): Promise<LabOrderListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<LabOrderListResponse>(apiConfig, "GET", `/api/lab/orders${qs}`);
}
