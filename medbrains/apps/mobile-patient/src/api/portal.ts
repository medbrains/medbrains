/**
 * Patient portal endpoints — the only ones this app is allowed to call.
 *
 * Every read here is subject-locked at the backend: the patient is taken from
 * the token, so there is no id to pass and none to get wrong. That is why none
 * of these functions accept a patient identifier.
 */

import { request } from "./client.js";
import { apiConfig } from "./config.js";

export interface PortalSession {
  token: string;
  patient_id: string;
  tenant_id: string;
  expires_in_hours: number;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  created_at: string;
}

/**
 * Asks for a sign-in code. The reply is the same whether or not the number is
 * registered, so this cannot be used to find out who is a patient here — do not
 * branch on it.
 */
export async function requestPortalOtp(tenantCode: string, phone: string): Promise<void> {
  await request(apiConfig, "POST", "/api/portal/auth/request-otp", {
    tenant_code: tenantCode,
    phone,
  });
}

export async function verifyPortalOtp(
  tenantCode: string,
  phone: string,
  code: string,
): Promise<PortalSession> {
  return request<PortalSession>(apiConfig, "POST", "/api/portal/auth/verify", {
    tenant_code: tenantCode,
    phone,
    code,
  });
}

export async function listPortalBills(): Promise<PortalInvoice[]> {
  return request<PortalInvoice[]>(apiConfig, "GET", "/api/portal/bills");
}

export interface PortalLabReport {
  order_id: string;
  test_name: string;
  parameter_name: string;
  value: string;
  unit: string | null;
  normal_range: string | null;
  flag: string | null;
  reported_at: string;
}

export interface PortalPrescriptionItem {
  prescription_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescribed_at: string;
}

export interface PortalAppointment {
  id: string;
  appointment_date: string;
  status: string;
  department_name: string | null;
}

/**
 * Only verified results, and nothing carrying an unacknowledged critical alert
 * — the backend applies both rules, so this list is already safe to show.
 */
export async function listPortalLabReports(): Promise<PortalLabReport[]> {
  return request<PortalLabReport[]>(apiConfig, "GET", "/api/portal/lab-reports");
}

export async function listPortalPrescriptions(): Promise<PortalPrescriptionItem[]> {
  return request<PortalPrescriptionItem[]>(apiConfig, "GET", "/api/portal/prescriptions");
}

export async function listPortalAppointments(): Promise<PortalAppointment[]> {
  return request<PortalAppointment[]>(apiConfig, "GET", "/api/portal/appointments");
}
