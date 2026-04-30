/**
 * Billing API methods — invoices.
 */

import { apiConfig } from "./config.js";
import { request } from "./client.js";

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  patient_id: string;
  status: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  created_at: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceRow[];
  total: number;
  page: number;
  per_page: number;
}

export async function listInvoices(status?: string): Promise<InvoiceListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<InvoiceListResponse>(apiConfig, "GET", `/api/billing/invoices${qs}`);
}
