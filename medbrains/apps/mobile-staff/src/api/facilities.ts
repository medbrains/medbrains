/**
 * Facilities API methods — work orders + compliance.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface WorkOrderRow {
  id: string;
  work_order_number: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  scheduled_date: string | null;
  total_cost: string | null;
  created_at: string;
}

export async function listWorkOrders(status?: string): Promise<WorkOrderRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<WorkOrderRow[]>(apiConfig, "GET", `/api/facilities/work-orders${qs}`);
}
