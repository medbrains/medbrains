/**
 * Housekeeping API methods — cleaning task worklist.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

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
