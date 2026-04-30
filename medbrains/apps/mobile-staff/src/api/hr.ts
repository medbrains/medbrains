/**
 * HR API methods — attendance + leave.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_name: string;
  shift_date: string;
  punch_in_at: string | null;
  punch_out_at: string | null;
  hours_worked: string | null;
  status: string;
}

export async function listAttendance(date?: string): Promise<AttendanceRow[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AttendanceRow[]>(apiConfig, "GET", `/api/hr/attendance${qs}`);
}
