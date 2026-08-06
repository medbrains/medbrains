/**
 * Housekeeping API methods — cleaning task worklist.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface CleaningTaskRow {
  id: string;
  area: string;
  task_type: string;
  scheduled_at: string;
  status: string;
  assigned_to: string | null;
  completed_at: string | null;
}

export async function listCleaningTasks(status?: string): Promise<CleaningTaskRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<CleaningTaskRow[]>(apiConfig, "GET", `/api/housekeeping/cleaning/tasks${qs}`);
}

export interface TurnaroundRow {
  id: string;
  location_id: string | null;
  discharge_at: string | null;
  dirty_at: string | null;
  cleaning_started_at: string | null;
  cleaning_completed_at: string | null;
  ready_at: string | null;
  turnaround_minutes: number | null;
}

export async function listTurnarounds(): Promise<TurnaroundRow[]> {
  return request<TurnaroundRow[]>(apiConfig, "GET", "/api/housekeeping/turnarounds");
}

/**
 * Marks the bed clean. Until this lands the bed reads as unavailable, so the
 * delay between the room actually being ready and someone reaching a desktop
 * to say so is time a patient spends waiting in Emergency for a bed that is
 * already made.
 */
export async function completeTurnaround(id: string): Promise<TurnaroundRow> {
  return request<TurnaroundRow>(apiConfig, "PUT", `/api/housekeeping/turnarounds/${id}/complete`);
}
