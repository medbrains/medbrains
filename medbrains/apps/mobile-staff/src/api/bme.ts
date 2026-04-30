/**
 * BME / CMMS API methods — equipment register + breakdowns.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

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
