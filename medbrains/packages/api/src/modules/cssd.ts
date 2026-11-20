/** The `/cssd` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddCssdLoadItemRequest,
  CreateCssdInstrumentRequest,
  CreateCssdIssuanceRequest,
  CreateCssdLoadRequest,
  CreateCssdMaintenanceRequest,
  CreateCssdSetRequest,
  CreateCssdSterilizerRequest,
  CssdIndicatorResult,
  CssdInstrument,
  CssdInstrumentSet,
  CssdIssuance,
  CssdLoadIssuance,
  CssdLoadItem,
  CssdLoadRecallResponse,
  CssdMaintenanceLog,
  CssdPack,
  CssdSetItem,
  CssdSterilizationLoad,
  CssdSterilizer,
  RecordCssdIndicatorRequest,
  UpdateCssdInstrumentRequest,
  UpdateCssdLoadStatusRequest,
  UpdateCssdSterilizerRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const cssdApi = {
  // ── CSSD ───────────────────────────────────────────────

  listCssdInstruments: () => request<CssdInstrument[]>("/cssd/instruments"),
  createCssdInstrument: (data: CreateCssdInstrumentRequest) =>
    request<CssdInstrument>("/cssd/instruments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdInstrument: (id: string, data: UpdateCssdInstrumentRequest) =>
    request<CssdInstrument>(`/cssd/instruments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCssdSets: () => request<CssdInstrumentSet[]>("/cssd/sets"),
  createCssdSet: (data: CreateCssdSetRequest) =>
    request<CssdInstrumentSet>("/cssd/sets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCssdSetItems: (setId: string) => request<CssdSetItem[]>(`/cssd/sets/${setId}/items`),
  listCssdSterilizers: () => request<CssdSterilizer[]>("/cssd/sterilizers"),
  createCssdSterilizer: (data: CreateCssdSterilizerRequest) =>
    request<CssdSterilizer>("/cssd/sterilizers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdSterilizer: (id: string, data: UpdateCssdSterilizerRequest) =>
    request<CssdSterilizer>(`/cssd/sterilizers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCssdMaintenanceLogs: (sterilizerId: string) =>
    request<CssdMaintenanceLog[]>(`/cssd/sterilizers/${sterilizerId}/maintenance`),
  createCssdMaintenanceLog: (sterilizerId: string, data: CreateCssdMaintenanceRequest) =>
    request<CssdMaintenanceLog>(`/cssd/sterilizers/${sterilizerId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdLoads: () => request<CssdSterilizationLoad[]>("/cssd/loads"),
  createCssdLoad: (data: CreateCssdLoadRequest) =>
    request<CssdSterilizationLoad>("/cssd/loads", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCssdLoadStatus: (id: string, data: UpdateCssdLoadStatusRequest) =>
    request<CssdSterilizationLoad>(`/cssd/loads/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCssdLoadItems: (loadId: string) => request<CssdPack[]>(`/cssd/loads/${loadId}/items`),
  listCssdLoadIssuances: (loadId: string) =>
    request<CssdLoadIssuance[]>(`/cssd/loads/${loadId}/issuances`),
  recallCssdLoad: (loadId: string, reason: string) =>
    request<CssdLoadRecallResponse>(`/cssd/loads/${loadId}/recall`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  addCssdLoadItem: (loadId: string, data: AddCssdLoadItemRequest) =>
    request<CssdLoadItem>(`/cssd/loads/${loadId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdIndicators: (loadId: string) =>
    request<CssdIndicatorResult[]>(`/cssd/loads/${loadId}/indicators`),
  recordCssdIndicator: (loadId: string, data: RecordCssdIndicatorRequest) =>
    request<CssdIndicatorResult>(`/cssd/loads/${loadId}/indicators`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCssdIssuances: () => request<CssdIssuance[]>("/cssd/issuances"),
  createCssdIssuance: (data: CreateCssdIssuanceRequest) =>
    request<CssdIssuance>("/cssd/issuances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  returnCssdIssuance: (id: string) =>
    request<CssdIssuance>(`/cssd/issuances/${id}/return`, {
      method: "PUT",
      body: JSON.stringify({}),
    }),
  recallCssdIssuance: (id: string, reason: string) =>
    request<CssdIssuance>(`/cssd/issuances/${id}/recall`, {
      method: "PUT",
      body: JSON.stringify({ recall_reason: reason }),
    }),
};
