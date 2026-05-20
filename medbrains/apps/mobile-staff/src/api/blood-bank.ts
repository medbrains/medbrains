/**
 * Blood bank mobile API methods. These are deliberately read-focused
 * for handheld use: inventory, crossmatch, transfusion, and donor
 * camp safety checks stay visible without replacing the full web desk.
 */

import type {
  BloodComponent,
  CrossmatchRequest,
  DonorListResponse,
  HemovigilanceReport,
  TransfusionRecord,
  TtiReport,
} from "@medbrains/types";
import { request } from "./client.js";
import { apiConfig } from "./config.js";

export async function listBloodDonors(params?: {
  blood_group?: string;
  deferred?: string;
}): Promise<DonorListResponse> {
  const qs = new URLSearchParams();
  if (params?.blood_group) qs.set("blood_group", params.blood_group);
  if (params?.deferred) qs.set("deferred", params.deferred);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<DonorListResponse>(apiConfig, "GET", `/api/blood-bank/donors${suffix}`);
}

export async function listBloodComponents(params?: {
  blood_group?: string;
  status?: string;
}): Promise<BloodComponent[]> {
  const qs = new URLSearchParams();
  if (params?.blood_group) qs.set("blood_group", params.blood_group);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<BloodComponent[]>(apiConfig, "GET", `/api/blood-bank/components${suffix}`);
}

export async function listCrossmatchRequests(): Promise<CrossmatchRequest[]> {
  return request<CrossmatchRequest[]>(apiConfig, "GET", "/api/blood-bank/crossmatch");
}

export async function listTransfusions(): Promise<TransfusionRecord[]> {
  return request<TransfusionRecord[]>(apiConfig, "GET", "/api/blood-bank/transfusions");
}

export async function getTtiReport(): Promise<TtiReport> {
  return request<TtiReport>(apiConfig, "GET", "/api/blood-bank/tti-report");
}

export async function getHemovigilanceReport(): Promise<HemovigilanceReport> {
  return request<HemovigilanceReport>(apiConfig, "GET", "/api/blood-bank/hemovigilance");
}
