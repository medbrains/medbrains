/**
 * Security API methods — incident log.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface IncidentRow {
  id: string;
  incident_number: string;
  category: string;
  severity: string;
  status: string;
  reported_at: string;
  reported_by: string | null;
  location: string | null;
  description: string;
}

export async function listSecurityIncidents(status?: string): Promise<IncidentRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<IncidentRow[]>(apiConfig, "GET", `/api/security/incidents${qs}`);
}
