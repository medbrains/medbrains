/**
 * Facilities API methods — work orders + compliance.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

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

export interface RaiseWorkOrderInput {
  description: string;
  priority?: string;
  category?: string;
  notes?: string;
}

/**
 * Raised by whoever found the fault, which is rarely a maintenance engineer.
 * The server assigns the number and the reporter from the token.
 */
export async function raiseWorkOrder(input: RaiseWorkOrderInput): Promise<WorkOrderRow> {
  return request<WorkOrderRow>(apiConfig, "POST", "/api/facilities/work-orders", input);
}

export interface GasReadingInput {
  gas_type: string;
  source_type: string;
  purity_percent?: number;
  pressure_bar?: number;
  tank_level_percent?: number;
  is_alarm: boolean;
  alarm_reason?: string;
  notes?: string;
}

export interface GasReadingRow {
  id: string;
  gas_type: string;
  source_type: string;
  purity_percent: number | null;
  pressure_bar: number | null;
  tank_level_percent: number | null;
  is_alarm: boolean;
  reading_at: string;
}

export async function listGasReadings(): Promise<GasReadingRow[]> {
  return request<GasReadingRow[]>(apiConfig, "GET", "/api/facilities/gas-readings");
}

/**
 * Recorded at the manifold. Medical gas is a PESO-logged, life-critical
 * supply — the reason this belongs on a phone is that the plant room is
 * nowhere near a desk.
 */
export async function recordGasReading(input: GasReadingInput): Promise<GasReadingRow> {
  return request<GasReadingRow>(apiConfig, "POST", "/api/facilities/gas-readings", input);
}

export interface FireEquipmentRow {
  id: string;
  name: string;
  equipment_type: string;
  serial_number: string | null;
  capacity: string | null;
  expiry_date: string | null;
  next_refill_date: string | null;
  barcode_value: string | null;
  qr_code_value: string | null;
}

/**
 * Active fire equipment only. A hospital has a few hundred of these, which is
 * why the scan matches client-side — unlike a drug catalogue, the whole set
 * fits comfortably on a phone and there is no barcode filter server-side.
 */
export async function listFireEquipment(): Promise<FireEquipmentRow[]> {
  return request<FireEquipmentRow[]>(
    apiConfig,
    "GET",
    "/api/facilities/fire-equipment?is_active=true",
  );
}

export interface FireInspectionInput {
  equipment_id: string;
  inspection_date: string;
  is_functional: boolean;
  findings?: string;
}

export async function recordFireInspection(input: FireInspectionInput): Promise<unknown> {
  return request<unknown>(apiConfig, "POST", "/api/facilities/fire-inspections", input);
}
