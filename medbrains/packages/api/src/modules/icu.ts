/** The `/icu` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateIcuBundleCheckRequest,
  CreateIcuDeviceRequest,
  CreateIcuFlowsheetRequest,
  CreateIcuNeonatalRequest,
  CreateIcuNutritionRequest,
  CreateIcuScoreRequest,
  CreateIcuVentilatorRequest,
  DeviceInfectionRate,
  IcuBundleCheck,
  IcuDevice,
  IcuFlowsheet,
  IcuLosAnalytics,
  IcuNeonatalRecord,
  IcuNutrition,
  IcuScore,
  IcuVentilatorRecord,
} from "@medbrains/types";
import { request } from "../client.js";

export const icuApi = {
  // ── ICU / Critical Care ────────────────────────────────

  listIcuFlowsheets: (admissionId: string) =>
    request<IcuFlowsheet[]>(`/icu/admissions/${admissionId}/flowsheets`),
  createIcuFlowsheet: (admissionId: string, data: CreateIcuFlowsheetRequest) =>
    request<IcuFlowsheet>(`/icu/admissions/${admissionId}/flowsheets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuVentilatorRecords: (admissionId: string) =>
    request<IcuVentilatorRecord[]>(`/icu/admissions/${admissionId}/ventilator`),
  createIcuVentilatorRecord: (admissionId: string, data: CreateIcuVentilatorRequest) =>
    request<IcuVentilatorRecord>(`/icu/admissions/${admissionId}/ventilator`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuScores: (admissionId: string) =>
    request<IcuScore[]>(`/icu/admissions/${admissionId}/scores`),
  createIcuScore: (admissionId: string, data: CreateIcuScoreRequest) =>
    request<IcuScore>(`/icu/admissions/${admissionId}/scores`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuDevices: (admissionId: string) =>
    request<IcuDevice[]>(`/icu/admissions/${admissionId}/devices`),
  createIcuDevice: (admissionId: string, data: CreateIcuDeviceRequest) =>
    request<IcuDevice>(`/icu/admissions/${admissionId}/devices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeIcuDevice: (admissionId: string, deviceId: string) =>
    request<IcuDevice>(`/icu/admissions/${admissionId}/devices/${deviceId}`, {
      method: "PUT",
    }),
  listIcuBundleChecks: (admissionId: string, deviceId: string) =>
    request<IcuBundleCheck[]>(`/icu/admissions/${admissionId}/devices/${deviceId}/bundle-checks`),
  createIcuBundleCheck: (
    admissionId: string,
    deviceId: string,
    data: CreateIcuBundleCheckRequest,
  ) =>
    request<IcuBundleCheck>(`/icu/admissions/${admissionId}/devices/${deviceId}/bundle-checks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuNutrition: (admissionId: string) =>
    request<IcuNutrition[]>(`/icu/admissions/${admissionId}/nutrition`),
  createIcuNutrition: (admissionId: string, data: CreateIcuNutritionRequest) =>
    request<IcuNutrition>(`/icu/admissions/${admissionId}/nutrition`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listIcuNeonatalRecords: (admissionId: string) =>
    request<IcuNeonatalRecord[]>(`/icu/admissions/${admissionId}/neonatal`),
  createIcuNeonatalRecord: (admissionId: string, data: CreateIcuNeonatalRequest) =>
    request<IcuNeonatalRecord>(`/icu/admissions/${admissionId}/neonatal`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getIcuLosAnalytics: () => request<IcuLosAnalytics>("/icu/analytics/los"),
  getIcuDeviceInfectionRates: () =>
    request<DeviceInfectionRate[]>("/icu/analytics/device-infections"),
};
