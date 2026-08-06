/**
 * Security API methods — incident log.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

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

export interface ReportIncidentInput {
  category: string;
  severity: string;
  description: string;
  location_description?: string;
  occurred_at?: string;
}

/**
 * A guard reports from wherever the incident happened, which is the point of
 * having this on a phone at all. `occurred_at` is sent explicitly rather than
 * left to the server clock — writing it up ten minutes later is normal, and the
 * time it happened is what an investigation and any police report turn on.
 */
export async function reportSecurityIncident(input: ReportIncidentInput): Promise<IncidentRow> {
  return request<IncidentRow>(apiConfig, "POST", "/api/security/incidents", input);
}
