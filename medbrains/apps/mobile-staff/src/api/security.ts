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

export interface TagAlertRow {
  id: string;
  tag_id: string;
  alert_type: string;
  triggered_at: string;
  location_description: string | null;
  is_resolved: boolean;
  was_false_alarm: boolean;
}

/**
 * Unresolved infant-RFID and wander-guard triggers. These are the Code Pink
 * path — a tagged patient crossing a boundary they should not — so the mobile
 * app asks only for the ones nobody has closed.
 */
export async function listOpenTagAlerts(): Promise<TagAlertRow[]> {
  return request<TagAlertRow[]>(apiConfig, "GET", "/api/security/tag-alerts?is_resolved=false");
}

export interface ResolveTagAlertInput {
  was_false_alarm: boolean;
  resolution_notes: string;
}

export async function resolveTagAlert(
  id: string,
  input: ResolveTagAlertInput,
): Promise<TagAlertRow> {
  return request<TagAlertRow>(apiConfig, "PUT", `/api/security/tag-alerts/${id}/resolve`, input);
}
