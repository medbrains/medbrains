/** The `/emergency` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AdmitFromErRequest,
  AdmitFromErResponse,
  ConfirmPoliceReceiptRequest,
  CreateCodeActivationRequest,
  CreateErVisitRequest,
  CreateMassCasualtyEventRequest,
  CreateMlcCaseRequest,
  CreateMlcDocumentRequest,
  CreateMlcInjuryRequest,
  CreateObservationNoteRequest,
  CreatePoliceIntimationRequest,
  CreateResuscitationLogRequest,
  CreateTriageRequest,
  DeactivateCodeRequest,
  ErBay,
  ErBayRequest,
  ErCodeActivation,
  ErDischargeSummary,
  ErDischargeSummaryRequest,
  ErObservationNote,
  ErResuscitationLog,
  ErTriageAssessment,
  ErVisit,
  MassCasualtyEvent,
  MlcCase,
  MlcDocument,
  MlcInjury,
  MlcPoliceIntimation,
  UpdateErVisitRequest,
  UpdateMassCasualtyEventRequest,
  UpdateMlcCaseRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const emergencyApi = {
  // ── Emergency ─────────────────────────────────────────

  listErBays: () => request<ErBay[]>("/emergency/bays"),
  createErBay: (data: ErBayRequest) =>
    request<ErBay>("/emergency/bays", { method: "POST", body: JSON.stringify(data) }),
  updateErBay: (id: string, data: ErBayRequest) =>
    request<ErBay>(`/emergency/bays/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listErVisits: (params?: { patient_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.patient_id) qs.set("patient_id", params.patient_id);
    const query = qs.toString();
    return request<ErVisit[]>(`/emergency/visits${query ? `?${query}` : ""}`);
  },

  getErVisit: (id: string) => request<ErVisit>(`/emergency/visits/${id}`),

  createErVisit: (data: CreateErVisitRequest) =>
    request<ErVisit>("/emergency/visits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateErVisit: (id: string, data: UpdateErVisitRequest) =>
    request<ErVisit>(`/emergency/visits/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getErDischargeSummary: (visitId: string) =>
    request<ErDischargeSummary | null>(`/emergency/visits/${visitId}/discharge-summary`),
  createErDischargeSummary: (visitId: string, data: ErDischargeSummaryRequest) =>
    request<ErDischargeSummary>(`/emergency/visits/${visitId}/discharge-summary`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateErDischargeSummary: (visitId: string, data: ErDischargeSummaryRequest) =>
    request<ErDischargeSummary>(`/emergency/visits/${visitId}/discharge-summary`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  finalizeErDischargeSummary: (visitId: string) =>
    request<ErDischargeSummary>(`/emergency/visits/${visitId}/discharge-summary/finalize`, {
      method: "POST",
    }),
  listErObservationNotes: (visitId: string) =>
    request<ErObservationNote[]>(`/emergency/visits/${visitId}/observation-notes`),
  createErObservationNote: (visitId: string, data: CreateObservationNoteRequest) =>
    request<ErObservationNote>(`/emergency/visits/${visitId}/observation-notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTriageAssessments: (visitId: string) =>
    request<ErTriageAssessment[]>(`/emergency/visits/${visitId}/triage`),

  createTriageAssessment: (visitId: string, data: CreateTriageRequest) =>
    request<ErTriageAssessment>(`/emergency/visits/${visitId}/triage`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listResuscitationLogs: (visitId: string) =>
    request<ErResuscitationLog[]>(`/emergency/visits/${visitId}/resuscitation`),

  createResuscitationLog: (visitId: string, data: CreateResuscitationLogRequest) =>
    request<ErResuscitationLog>(`/emergency/visits/${visitId}/resuscitation`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCodeActivations: () => request<ErCodeActivation[]>("/emergency/codes"),

  createCodeActivation: (data: CreateCodeActivationRequest) =>
    request<ErCodeActivation>("/emergency/codes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivateCode: (id: string, data: DeactivateCodeRequest) =>
    request<ErCodeActivation>(`/emergency/codes/${id}/deactivate`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMlcCases: () => request<MlcCase[]>("/emergency/mlc"),

  createMlcCase: (data: CreateMlcCaseRequest) =>
    request<MlcCase>("/emergency/mlc", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMlcCase: (id: string, data: UpdateMlcCaseRequest) =>
    request<MlcCase>(`/emergency/mlc/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMlcDocuments: (mlcId: string) => request<MlcDocument[]>(`/emergency/mlc/${mlcId}/documents`),

  listMlcInjuries: (mlcId: string) => request<MlcInjury[]>(`/emergency/mlc/${mlcId}/injuries`),

  createMlcInjury: (mlcId: string, data: CreateMlcInjuryRequest) =>
    request<MlcInjury>(`/emergency/mlc/${mlcId}/injuries`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createMlcDocument: (mlcId: string, data: CreateMlcDocumentRequest) =>
    request<MlcDocument>(`/emergency/mlc/${mlcId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPoliceIntimations: (mlcId: string) =>
    request<MlcPoliceIntimation[]>(`/emergency/mlc/${mlcId}/police-intimations`),

  createPoliceIntimation: (mlcId: string, data: CreatePoliceIntimationRequest) =>
    request<MlcPoliceIntimation>(`/emergency/mlc/${mlcId}/police-intimations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  confirmPoliceReceipt: (id: string, data: ConfirmPoliceReceiptRequest) =>
    request<MlcPoliceIntimation>(`/emergency/mlc/police-intimations/${id}/confirm`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMassCasualtyEvents: () => request<MassCasualtyEvent[]>("/emergency/mass-casualty"),

  createMassCasualtyEvent: (data: CreateMassCasualtyEventRequest) =>
    request<MassCasualtyEvent>("/emergency/mass-casualty", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMassCasualtyEvent: (id: string, data: UpdateMassCasualtyEventRequest) =>
    request<MassCasualtyEvent>(`/emergency/mass-casualty/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  admitFromEr: (visitId: string, data: AdmitFromErRequest) =>
    request<AdmitFromErResponse>(`/emergency/visits/${visitId}/admit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
