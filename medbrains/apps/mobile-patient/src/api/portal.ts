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
