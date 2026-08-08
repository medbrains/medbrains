/**
 * BME / CMMS API methods — equipment register + breakdowns.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface EquipmentRow {
  id: string;
  name: string;
  asset_tag: string | null;
  serial_number: string | null;
  status: string;
  risk_category: string | null;
  department_id: string | null;
  next_pm_date: string | null;
  next_calibration_date: string | null;
}

export async function listEquipment(status?: string): Promise<EquipmentRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<EquipmentRow[]>(apiConfig, "GET", `/api/bme/equipment${qs}`);
}

export interface BreakdownInput {
  equipment_id: string;
  priority: string;
  description: string;
  downtime_start: string;
  vendor_visit_required?: boolean;
}

/**
 * Reported by whoever found the equipment failed, which at a bedside is a
 * nurse rather than an engineer. `downtime_start` is stamped by the client:
 * the clock that matters is when the device stopped being usable, not when
 * somebody got to a terminal.
 */
export async function reportBreakdown(input: BreakdownInput): Promise<unknown> {
  return request<unknown>(apiConfig, "POST", "/api/bme/breakdowns", input);
}
