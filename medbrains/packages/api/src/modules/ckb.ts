/** The `/ckb` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DiagnosisReference,
  DrugReference,
  IhipForm,
  IhipLineList,
  LabReference,
  NikshaySheet,
  NotifiableList,
  NotifiableOverride,
  NotifiableReport,
  PublicHealthFacility,
  SaveTbDetailsRequest,
  StateFormularyRow,
  StateScheme,
  SubmitIhipLineListRequest,
  TbCase,
  UpdateNotifiableReportRequest,
  UpsertNotifiableOverrideRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const ckbApi = {
  // Clinical Knowledge Base
  listCkbDiagnoses: (params?: { q?: string; notifiable_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.notifiable_only) qs.set("notifiable_only", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<DiagnosisReference[]>(`/ckb/diagnoses${suffix}`);
  },
  listCkbFormulary: (q?: string) =>
    request<DrugReference[]>(`/ckb/formulary${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  listCkbLabReference: (q?: string) =>
    request<LabReference[]>(`/ckb/lab-reference${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  listNlemGenerics: () => request<string[]>("/ckb/nlem-generics"),
  listCkbStateSchemes: () => request<StateScheme[]>("/ckb/state-schemes"),
  listCkbStateFormulary: (state: string) =>
    request<StateFormularyRow[]>(`/ckb/state-formulary?state=${encodeURIComponent(state)}`),
  listNotifiableReports: (status?: string) =>
    request<NotifiableReport[]>(`/ckb/notifiable-reports${status ? `?status=${status}` : ""}`),
  getNotifiableList: () => request<NotifiableList>("/ckb/notifiable-list"),
  listNotifiableOverrides: () => request<NotifiableOverride[]>("/ckb/notifiable-overrides"),
  upsertNotifiableOverride: (data: UpsertNotifiableOverrideRequest) =>
    request<NotifiableOverride>("/ckb/notifiable-overrides", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteNotifiableOverride: (id: string) =>
    request<{ deleted: boolean }>(`/ckb/notifiable-overrides/${id}`, { method: "DELETE" }),
  updateNotifiableReport: (id: string, data: UpdateNotifiableReportRequest) =>
    request<NotifiableReport>(`/ckb/notifiable-reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listTbCases: (status?: string) =>
    request<TbCase[]>(`/ckb/nikshay${status ? `?status=${status}` : ""}`),
  saveTbDetails: (reportId: string, data: SaveTbDetailsRequest) =>
    request<TbCase>(`/ckb/nikshay/${reportId}`, { method: "PUT", body: JSON.stringify(data) }),
  getNikshaySheet: () => request<NikshaySheet>("/ckb/nikshay/sheet"),
  getPublicHealthFacility: () => request<PublicHealthFacility>("/ckb/facility-codes"),
  getIhipLineList: (form: IhipForm, from: string, to: string) =>
    request<IhipLineList>(`/ckb/ihip/line-list?form=${form}&from=${from}&to=${to}`),
  submitIhipLineList: (data: SubmitIhipLineListRequest) =>
    request<{ submitted: number }>("/ckb/ihip/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  setPublicHealthFacilityCodes: (data: {
    nikshay_he_code: string | null;
    ihip_unit_id: string | null;
  }) =>
    request<PublicHealthFacility>("/ckb/facility-codes", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
