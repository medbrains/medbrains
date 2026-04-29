import type { APIRequestContext } from "@playwright/test";

export interface AuthContext {
  csrfToken: string;
  request: APIRequestContext;
  userId: string;
  tenantId: string;
}

export interface JourneyContext extends AuthContext {
  patientId: string;
  encounterId?: string;
  prescriptionId?: string;
  pharmacyOrderId?: string;
  labOrderId?: string;
  invoiceId?: string;
  admissionId?: string;
}

export interface ApiCallOptions {
  /** When set, on failure the helper retries the same call against each variant path. */
  variants?: string[];
  /** Override default expectation (>=200 && <300). */
  expectStatus?: number | number[];
  /** Skip CSRF header (e.g. for endpoints that don't require it). */
  skipCsrf?: boolean;
}

export interface SeedRefs {
  opdDept: { id: string; name: string; code: string };
  ipdDept: { id: string; name: string; code: string };
  drug: { id: string; name: string; code: string };
  labTest: { id: string; name: string; code: string };
  bed?: { id: string; bed_number: string };
}
