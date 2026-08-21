/**
 * The reception desk's API: visitors, passes, and the enquiry log.
 *
 * Wire shape mirrors `crates/medbrains-ancillary/src/front_office.rs`.
 */

import type {
  FrontOfficeEnquiryLog,
  VisitorLog,
  VisitorPass,
  VisitorRegistration,
} from "@medbrains/types";

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export type {
  FrontOfficeEnquiryLog,
  VisitorLog,
  VisitorPass,
  VisitorRegistration,
} from "@medbrains/types";

export interface RegisterVisitorPayload {
  visitor_name: string;
  phone?: string;
  id_type?: string;
  id_number?: string;
  relationship?: string;
  category?: string;
  patient_id?: string;
  purpose?: string;
}

export interface IssuePassPayload {
  registration_id: string;
  bed_number?: string;
  valid_hours?: number;
}

export async function listVisitors(): Promise<VisitorRegistration[]> {
  return request<VisitorRegistration[]>(apiConfig, "GET", "/api/front-office/visitors");
}

export async function registerVisitor(
  payload: RegisterVisitorPayload,
): Promise<VisitorRegistration> {
  return request<VisitorRegistration>(apiConfig, "POST", "/api/front-office/visitors", payload);
}

export async function listPasses(): Promise<VisitorPass[]> {
  return request<VisitorPass[]>(apiConfig, "GET", "/api/front-office/passes");
}

export async function issuePass(payload: IssuePassPayload): Promise<VisitorPass> {
  return request<VisitorPass>(apiConfig, "POST", "/api/front-office/passes", payload);
}

/**
 * Revoking is the honest end of a pass.
 *
 * There is no deletion: a pass that was issued and then withdrawn is a fact
 * about who was in the building, and the reason is part of it.
 */
export async function revokePass(id: string, reason: string): Promise<VisitorPass> {
  return request<VisitorPass>(apiConfig, "PUT", `/api/front-office/passes/${id}/revoke`, {
    reason,
  });
}

export async function checkInVisitor(passId: string, gate?: string): Promise<VisitorLog> {
  return request<VisitorLog>(
    apiConfig,
    "POST",
    `/api/front-office/visitor-logs/${passId}/check-in`,
    { gate },
  );
}

export async function checkOutVisitor(passId: string): Promise<VisitorLog> {
  return request<VisitorLog>(
    apiConfig,
    "POST",
    `/api/front-office/visitor-logs/${passId}/check-out`,
    {},
  );
}

export async function listEnquiries(): Promise<FrontOfficeEnquiryLog[]> {
  return request<FrontOfficeEnquiryLog[]>(apiConfig, "GET", "/api/front-office/enquiries");
}

export interface LogEnquiryPayload {
  caller_name?: string;
  caller_phone?: string;
  enquiry_type?: string;
  response_text?: string;
}

export async function logEnquiry(payload: LogEnquiryPayload): Promise<FrontOfficeEnquiryLog> {
  return request<FrontOfficeEnquiryLog>(apiConfig, "POST", "/api/front-office/enquiries", payload);
}

export async function resolveEnquiry(
  id: string,
  responseText: string,
): Promise<FrontOfficeEnquiryLog> {
  return request<FrontOfficeEnquiryLog>(
    apiConfig,
    "PUT",
    `/api/front-office/enquiries/${id}/resolve`,
    { response_text: responseText },
  );
}
