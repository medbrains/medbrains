/** The `/camp` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddCampCounterRequest,
  AddCampTeamMemberRequest,
  BulkCreateCampSupplyItemsRequest,
  BulkCreateCampSupplyItemsResponse,
  Camp,
  CampAnalytics,
  CampAssetReservation,
  CampBillingRecord,
  CampCounter,
  CampFollowup,
  CampIncident,
  CampLabSample,
  CampMedicineOption,
  CampOpenEncounterResponse,
  CampPacketResponse,
  CampPlanningSummary,
  CampReferral,
  CampRegistration,
  CampRemoteChecklistItem,
  CampRemoteOperationsResponse,
  CampRemoteSetup,
  CampReport,
  CampScreening,
  CampStaffOption,
  CampStatsResponse,
  CampSupplyItem,
  CampSyncInboundRequest,
  CampSyncInboundResponse,
  CampTeamMember,
  CancelCampRequest,
  CreateCampAssetReservationRequest,
  CreateCampBillingRequest,
  CreateCampFollowupRequest,
  CreateCampIncidentRequest,
  CreateCampLabSampleRequest,
  CreateCampReferralRequest,
  CreateCampRegistrationRequest,
  CreateCampRequest,
  CreateCampScreeningRequest,
  CreateCampSupplyItemRequest,
  IssueCampAssetRequest,
  LinkCampLabSampleRequest,
  ListCampAssetCandidatesParams,
  OpenCampRegistrationEncounterRequest,
  ReturnCampAssetRequest,
  UnifiedAsset,
  UpdateCampFollowupRequest,
  UpdateCampIncidentRequest,
  UpdateCampReferralRequest,
  UpdateCampRegistrationRequest,
  UpdateCampRemoteChecklistItemRequest,
  UpdateCampRequest,
  UpdateCampSupplyItemRequest,
  UpsertCampRemoteSetupRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const campApi = {
  // ── Camp Management ────────────────────────────────────

  listCamps: (params?: { status?: string; camp_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.camp_type) sp.set("camp_type", params.camp_type);
    const qs = sp.toString();
    return request<Camp[]>(`/camp/camps${qs ? `?${qs}` : ""}`);
  },
  getCamp: (id: string) => request<Camp>(`/camp/camps/${id}`),
  createCamp: (data: CreateCampRequest) =>
    request<Camp>("/camp/camps", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCamp: (id: string, data: UpdateCampRequest) =>
    request<Camp>(`/camp/camps/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  approveCamp: (id: string) => request<Camp>(`/camp/camps/${id}/approve`, { method: "PUT" }),
  activateCamp: (id: string) => request<Camp>(`/camp/camps/${id}/activate`, { method: "PUT" }),
  completeCamp: (id: string) => request<Camp>(`/camp/camps/${id}/complete`, { method: "PUT" }),
  cancelCamp: (id: string, data: CancelCampRequest) =>
    request<Camp>(`/camp/camps/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampTeamMembers: (campId: string) => request<CampTeamMember[]>(`/camp/camps/${campId}/team`),
  addCampTeamMember: (campId: string, data: AddCampTeamMemberRequest) =>
    request<CampTeamMember>(`/camp/camps/${campId}/team`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeCampTeamMember: (campId: string, memberId: string) =>
    request<{ deleted: boolean }>(`/camp/camps/${campId}/team/${memberId}`, {
      method: "DELETE",
    }),
  listCampCounters: (campId: string) => request<CampCounter[]>(`/camp/camps/${campId}/counters`),
  /** Start a camp's route of stations from a template (only "general" today). */
  applyCampRouteTemplate: (campId: string, template = "general") =>
    request<{ counter_id: string; name: string; flow_position: number }[]>(
      `/camp/camps/${campId}/route-template`,
      { method: "POST", body: JSON.stringify({ template }) },
    ),
  addCampCounter: (campId: string, data: AddCampCounterRequest) =>
    request<CampCounter>(`/camp/camps/${campId}/counters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeCampCounter: (campId: string, counterId: string) =>
    request<{ deleted: boolean }>(`/camp/camps/${campId}/counters/${counterId}`, {
      method: "DELETE",
    }),
  getCampStats: (campId: string) => request<CampStatsResponse>(`/camp/camps/${campId}/stats`),
  getCampPlanningSummary: (campId: string) =>
    request<CampPlanningSummary>(`/camp/camps/${campId}/planning-summary`),
  listCampAssetCandidates: (campId: string, params?: ListCampAssetCandidatesParams) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.asset_domain) sp.set("asset_domain", params.asset_domain);
    if (params?.asset_category_id) sp.set("asset_category_id", params.asset_category_id);
    if (params?.search) sp.set("search", params.search);
    if (params?.required_from) sp.set("required_from", params.required_from);
    if (params?.required_to) sp.set("required_to", params.required_to);
    const qs = sp.toString();
    return request<UnifiedAsset[]>(`/camp/camps/${campId}/asset-candidates${qs ? `?${qs}` : ""}`);
  },
  listCampAssetReservations: (campId: string) =>
    request<CampAssetReservation[]>(`/camp/camps/${campId}/asset-reservations`),
  createCampAssetReservation: (campId: string, data: CreateCampAssetReservationRequest) =>
    request<CampAssetReservation>(`/camp/camps/${campId}/asset-reservations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  issueCampAssetReservation: (id: string, data: IssueCampAssetRequest) =>
    request<CampAssetReservation>(`/camp/asset-reservations/${id}/issue`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  returnCampAssetReservation: (id: string, data: ReturnCampAssetRequest) =>
    request<CampAssetReservation>(`/camp/asset-reservations/${id}/return`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelCampAssetReservation: (id: string) =>
    request<CampAssetReservation>(`/camp/asset-reservations/${id}/cancel`, {
      method: "PUT",
    }),
  getCampPacket: (campId: string, params?: { device_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.device_id) sp.set("device_id", params.device_id);
    const qs = sp.toString();
    return request<CampPacketResponse>(`/camp/camps/${campId}/packet${qs ? `?${qs}` : ""}`);
  },
  listCampStaffOptions: (params?: { search?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set("search", params.search);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<CampStaffOption[]>(`/camp/lookups/staff${qs ? `?${qs}` : ""}`);
  },
  listCampMedicineOptions: (params?: { search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<CampMedicineOption[]>(`/camp/lookups/medicines${qs ? `?${qs}` : ""}`);
  },
  syncCampInbound: (data: CampSyncInboundRequest) =>
    request<CampSyncInboundResponse>("/camp/sync/inbound", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCampRemoteOperations: (campId: string) =>
    request<CampRemoteOperationsResponse>(`/camp/camps/${campId}/remote-operations`),
  upsertCampRemoteSetup: (campId: string, data: UpsertCampRemoteSetupRequest) =>
    request<CampRemoteSetup>(`/camp/camps/${campId}/remote-setup`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateCampRemoteChecklistItem: (id: string, data: UpdateCampRemoteChecklistItemRequest) =>
    request<CampRemoteChecklistItem>(`/camp/remote-checklist/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createCampSupplyItem: (campId: string, data: CreateCampSupplyItemRequest) =>
    request<CampSupplyItem>(`/camp/camps/${campId}/supplies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  bulkCreateCampSupplyItems: (campId: string, data: BulkCreateCampSupplyItemsRequest) =>
    request<BulkCreateCampSupplyItemsResponse>(`/camp/camps/${campId}/supplies/bulk`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampSupplyItem: (id: string, data: UpdateCampSupplyItemRequest) =>
    request<CampSupplyItem>(`/camp/supplies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampReferrals: (campId: string) => request<CampReferral[]>(`/camp/camps/${campId}/referrals`),
  createCampReferral: (campId: string, data: CreateCampReferralRequest) =>
    request<CampReferral>(`/camp/camps/${campId}/referrals`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampReferral: (id: string, data: UpdateCampReferralRequest) =>
    request<CampReferral>(`/camp/referrals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createCampIncident: (campId: string, data: CreateCampIncidentRequest) =>
    request<CampIncident>(`/camp/camps/${campId}/incidents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampIncident: (id: string, data: UpdateCampIncidentRequest) =>
    request<CampIncident>(`/camp/incidents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampRegistrations: (params: {
    camp_id?: string;
    status?: string;
    patient_id?: string;
    /** One box over registration number, phone, ID number, name and complaint. */
    q?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.camp_id) sp.set("camp_id", params.camp_id);
    if (params.status) sp.set("status", params.status);
    if (params.patient_id) sp.set("patient_id", params.patient_id);
    if (params.q) sp.set("q", params.q);
    return request<CampRegistration[]>(`/camp/registrations?${sp.toString()}`);
  },
  createCampRegistration: (data: CreateCampRegistrationRequest) =>
    /** `token_number`: the number the camp calls them by, when it runs a route. */
    request<CampRegistration & { token_number: string | null }>("/camp/registrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampRegistration: (id: string, data: UpdateCampRegistrationRequest) =>
    request<CampRegistration>(`/camp/registrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  openCampRegistrationEncounter: (id: string, data?: OpenCampRegistrationEncounterRequest) =>
    request<CampOpenEncounterResponse>(`/camp/registrations/${id}/open-encounter`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  listCampScreenings: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampScreening[]>(`/camp/screenings${qs ? `?${qs}` : ""}`);
  },
  createCampScreening: (data: CreateCampScreeningRequest) =>
    request<CampScreening>("/camp/screenings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCampLabSamples: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampLabSample[]>(`/camp/lab-samples${qs ? `?${qs}` : ""}`);
  },
  createCampLabSample: (data: CreateCampLabSampleRequest) =>
    request<CampLabSample>("/camp/lab-samples", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  linkCampLabSample: (id: string, data: LinkCampLabSampleRequest) =>
    request<CampLabSample>(`/camp/lab-samples/${id}/link`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCampBilling: (params?: { camp_id?: string; registration_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    const qs = sp.toString();
    return request<CampBillingRecord[]>(`/camp/billing${qs ? `?${qs}` : ""}`);
  },
  createCampBilling: (data: CreateCampBillingRequest) =>
    request<CampBillingRecord>("/camp/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCampFollowups: (params?: { camp_id?: string; registration_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.camp_id) sp.set("camp_id", params.camp_id);
    if (params?.registration_id) sp.set("registration_id", params.registration_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CampFollowup[]>(`/camp/followups${qs ? `?${qs}` : ""}`);
  },
  createCampFollowup: (data: CreateCampFollowupRequest) =>
    request<CampFollowup>("/camp/followups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampFollowup: (id: string, data: UpdateCampFollowupRequest) =>
    request<CampFollowup>(`/camp/followups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Camp (extended)
  // ══════════════════════════════════════════════════════════

  campAnalytics: () => request<CampAnalytics>("/camp/analytics"),

  campReport: (campId: string) => request<CampReport>(`/camp/camps/${campId}/report`),
};
