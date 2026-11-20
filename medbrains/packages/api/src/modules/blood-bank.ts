/** The `/blood-bank` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddBbReadingRequest,
  BbBillingItemRow,
  BbBloodReturnRow,
  BbColdChainDeviceRow,
  BbColdChainReadingRow,
  BbLookbackEventRow,
  BbMsbosGuidelineRow,
  BbRecruitmentCampaignRow,
  BbSbtcReport,
  BloodComponent,
  BloodDonation,
  BloodDonor,
  CreateBbBillingRequest,
  CreateBbCampaignRequest,
  CreateBbDeviceRequest,
  CreateBbLookbackRequest,
  CreateBbMsbosRequest,
  CreateBbReturnRequest,
  CreateComponentRequest,
  CreateCrossmatchRequestBody,
  CreateDonationRequest,
  CreateDonorRequest,
  CreateTransfusionRequest,
  CrossmatchRequest,
  DonorListResponse,
  HemovigilanceReport,
  InspectBbReturnRequest,
  RecordReactionRequest,
  RecordTransfusionObservationRequest,
  RecordTtiRequest,
  SetDonorDeferralRequest,
  TransfusionObservation,
  TransfusionRecord,
  TtiPanel,
  TtiReport,
  UpdateBbCampaignRequest,
  UpdateBbLookbackRequest,
  UpdateComponentStatusRequest,
  UpdateCrossmatchRequestBody,
  UpdateDonationRequest,
} from "@medbrains/types";
import type { Paginated } from "../client.js";
import { request } from "../client.js";

export const bloodBankApi = {
  // ── Blood Bank ──────────────────────────────────────────

  listBloodDonors: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<DonorListResponse>(`/blood-bank/donors${qs}`);
  },
  createBloodDonor: (data: CreateDonorRequest) =>
    request<BloodDonor>("/blood-bank/donors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getBloodDonor: (id: string) => request<BloodDonor>(`/blood-bank/donors/${id}`),
  listDonations: (donorId: string) =>
    request<BloodDonation[]>(`/blood-bank/donors/${donorId}/donations`),
  createDonation: (donorId: string, data: CreateDonationRequest) =>
    request<BloodDonation>(`/blood-bank/donors/${donorId}/donations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDonation: (donationId: string, data: UpdateDonationRequest) =>
    request<BloodDonation>(`/blood-bank/donations/${donationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setDonorDeferral: (donorId: string, data: SetDonorDeferralRequest) =>
    request<BloodDonor>(`/blood-bank/donors/${donorId}/deferral`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listTtiResults: (donationId: string) =>
    request<TtiPanel>(`/blood-bank/donations/${donationId}/tti`),
  recordTtiResults: (donationId: string, data: RecordTtiRequest) =>
    request<TtiPanel>(`/blood-bank/donations/${donationId}/tti`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listBloodComponents: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BloodComponent[]>(`/blood-bank/components${qs}`);
  },
  createBloodComponent: (data: CreateComponentRequest) =>
    request<BloodComponent>("/blood-bank/components", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateComponentStatus: (id: string, data: UpdateComponentStatusRequest) =>
    request<BloodComponent>(`/blood-bank/components/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCrossmatchRequests: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<Paginated<CrossmatchRequest>>(`/blood-bank/crossmatch${q ? `?${q}` : ""}`);
  },
  createCrossmatchRequest: (data: CreateCrossmatchRequestBody) =>
    request<CrossmatchRequest>("/blood-bank/crossmatch", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCrossmatchRequest: (id: string, data: UpdateCrossmatchRequestBody) =>
    request<CrossmatchRequest>(`/blood-bank/crossmatch/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listTransfusions: () => request<TransfusionRecord[]>("/blood-bank/transfusions"),
  createTransfusion: (data: CreateTransfusionRequest) =>
    request<TransfusionRecord>("/blood-bank/transfusions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordTransfusionReaction: (id: string, data: RecordReactionRequest) =>
    request<TransfusionRecord>(`/blood-bank/transfusions/${id}/reaction`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listTransfusionObservations: (id: string) =>
    request<TransfusionObservation[]>(`/blood-bank/transfusions/${id}/observations`),
  recordTransfusionObservation: (id: string, data: RecordTransfusionObservationRequest) =>
    request<TransfusionObservation>(`/blood-bank/transfusions/${id}/observations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTtiReport: () => request<TtiReport>("/blood-bank/tti-report"),
  getHemovigilanceReport: () => request<HemovigilanceReport>("/blood-bank/hemovigilance"),

  // ── Blood Bank Phase 2 ──────────────────────────────────

  listBbCampaigns: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<BbRecruitmentCampaignRow[]>(`/blood-bank/recruitment${qs ? `?${qs}` : ""}`);
  },
  createBbCampaign: (data: CreateBbCampaignRequest) =>
    request<BbRecruitmentCampaignRow>("/blood-bank/recruitment", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBbCampaign: (id: string, data: UpdateBbCampaignRequest) =>
    request<BbRecruitmentCampaignRow>(`/blood-bank/recruitment/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listBbDevices: () => request<BbColdChainDeviceRow[]>("/blood-bank/cold-chain/devices"),
  createBbDevice: (data: CreateBbDeviceRequest) =>
    request<BbColdChainDeviceRow>("/blood-bank/cold-chain/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addBbReading: (data: AddBbReadingRequest) =>
    request<BbColdChainReadingRow>("/blood-bank/cold-chain/readings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listBbReadings: (deviceId: string) =>
    request<BbColdChainReadingRow[]>(`/blood-bank/cold-chain/readings?device_id=${deviceId}`),

  createBbReturn: (data: CreateBbReturnRequest) =>
    request<BbBloodReturnRow>("/blood-bank/returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  inspectBbReturn: (id: string, data: InspectBbReturnRequest) =>
    request<BbBloodReturnRow>(`/blood-bank/returns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listBbMsbos: () => request<BbMsbosGuidelineRow[]>("/blood-bank/msbos"),
  createBbMsbos: (data: CreateBbMsbosRequest) =>
    request<BbMsbosGuidelineRow>("/blood-bank/msbos", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listBbLookback: () => request<BbLookbackEventRow[]>("/blood-bank/lookback"),
  createBbLookback: (data: CreateBbLookbackRequest) =>
    request<BbLookbackEventRow>("/blood-bank/lookback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBbLookback: (id: string, data: UpdateBbLookbackRequest) =>
    request<BbLookbackEventRow>(`/blood-bank/lookback/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listBbBilling: (params?: { status?: string; patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<BbBillingItemRow[]>(`/blood-bank/billing${qs ? `?${qs}` : ""}`);
  },
  createBbBilling: (data: CreateBbBillingRequest) =>
    request<BbBillingItemRow>("/blood-bank/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getBbSbtcReport: () => request<BbSbtcReport>("/blood-bank/sbtc-report"),
};
