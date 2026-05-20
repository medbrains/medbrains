/**
 * Reference data used by mobile registration and clinical worklists.
 * These are the same setup/camp lists used by the web app, kept small
 * for handheld prefill and selection.
 */

import type { Camp, DepartmentRow, Facility, SetupUser } from "@medbrains/types";
import { request } from "./client.js";
import { apiConfig } from "./config.js";

export async function listDepartments(): Promise<DepartmentRow[]> {
  return request<DepartmentRow[]>(apiConfig, "GET", "/api/setup/departments");
}

export async function listDoctors(): Promise<SetupUser[]> {
  return request<SetupUser[]>(apiConfig, "GET", "/api/setup/doctors");
}

export async function listCamps(status?: string): Promise<Camp[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Camp[]>(apiConfig, "GET", `/api/camp/camps${qs}`);
}

export async function listFacilities(): Promise<Facility[]> {
  return request<Facility[]>(apiConfig, "GET", "/api/setup/facilities");
}
