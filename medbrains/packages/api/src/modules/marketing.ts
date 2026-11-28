/** The `/marketing` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddMarketingSuppressionRequest,
  AddMarketingTouchpointRequest,
  ConvertLeadRequest,
  ConvertLeadResponse,
  CreateMarketingClinicalCohortRequest,
  CreateMarketingContactRequest,
  CreateMarketingDistributionRequest,
  CreateMarketingEnquiryCohortRequest,
  LogMarketingInteractionRequest,
  MarketingArea,
  MarketingAreaPerformanceRow,
  MarketingCallback,
  MarketingCallbackSummary,
  MarketingCampAcquisitionRow,
  MarketingCampaign,
  MarketingCampaignAttributionRow,
  MarketingCampaignFunnelRow,
  MarketingCampaignOption,
  MarketingCampBridgeResult,
  MarketingChannelJourneyRow,
  MarketingCohort,
  MarketingConsentEntry,
  MarketingContact,
  MarketingDispatchResult,
  MarketingDistributionResult,
  MarketingFunnelStageRow,
  MarketingInteraction,
  MarketingMessageRow,
  MarketingMissedCallSummary,
  MarketingOutreachRun,
  MarketingPatientMatch,
  MarketingPipelineStage,
  MarketingScreenPop,
  MarketingSendPolicy,
  MarketingSuppression,
  MarketingTouchpoint,
  MarketingWebFormSetting,
  MoveMarketingStageRequest,
  RecordMarketingConsentRequest,
  UpsertMarketingAreaRequest,
  UpsertMarketingCampaignRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const marketingApi = {
  /**
   * Record that a supervisor has looked at a QC run.
   *
   * A rejected run holds every result for that test until this happens, so
   * this is the way out of that hold as well as the NABL evidence that
   * somebody reviewed it.
   */
  // ── Marketing ─────────────────────────────────────────────────
  listMarketingCampaigns: () => request<MarketingCampaign[]>("/marketing/campaigns"),
  /** Running campaigns, names only, for the registration desk. */
  lookupMarketingCampaigns: () => request<MarketingCampaignOption[]>("/marketing/campaigns/lookup"),

  createMarketingCampaign: (data: UpsertMarketingCampaignRequest) =>
    request<MarketingCampaign>("/marketing/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** A full replace — send every field, or the omitted ones are NULLed. */
  updateMarketingCampaign: (id: string, data: UpsertMarketingCampaignRequest) =>
    request<MarketingCampaign>(`/marketing/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listMarketingContacts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<MarketingContact[]>(`/marketing/contacts${qs}`);
  },

  getMarketingContact: (id: string) => request<MarketingContact>(`/marketing/contacts/${id}`),

  createMarketingContact: (data: CreateMarketingContactRequest) =>
    request<MarketingContact>("/marketing/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMarketingInteractions: (contactId: string) =>
    request<MarketingInteraction[]>(`/marketing/contacts/${contactId}/interactions`),

  logMarketingInteraction: (contactId: string, data: LogMarketingInteractionRequest) =>
    request<MarketingInteraction>(`/marketing/contacts/${contactId}/interactions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  moveMarketingStage: (contactId: string, data: MoveMarketingStageRequest) =>
    request<MarketingContact>(`/marketing/contacts/${contactId}/stage`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMarketingStages: () => request<MarketingPipelineStage[]>("/marketing/stages"),

  listMarketingOutreachRuns: () => request<MarketingOutreachRun[]>("/marketing/outreach"),

  submitMarketingOutreachRun: (id: string) =>
    request<MarketingOutreachRun>(`/marketing/outreach/${id}/submit`, { method: "POST" }),

  approveMarketingOutreachRun: (id: string) =>
    request<MarketingOutreachRun>(`/marketing/outreach/${id}/approve`, { method: "POST" }),

  cancelMarketingOutreachRun: (id: string) =>
    request<MarketingOutreachRun>(`/marketing/outreach/${id}/cancel`, { method: "POST" }),

  /** Who is calling. Requires `marketing.contacts.view`. */
  marketingScreenPop: (phone: string) =>
    request<MarketingScreenPop>(`/marketing/screen-pop?${new URLSearchParams({ phone })}`),

  listMarketingCohorts: () => request<MarketingCohort[]>("/marketing/cohorts"),

  createMarketingEnquiryCohort: (data: CreateMarketingEnquiryCohortRequest) =>
    request<MarketingCohort>("/marketing/cohorts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Requires `marketing.cohorts.clinical_define`, which marketing roles do not hold. */
  createMarketingClinicalCohort: (data: CreateMarketingClinicalCohortRequest) =>
    request<MarketingCohort>("/marketing/cohorts/clinical", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  marketingCohortSize: (id: string) =>
    request<{ cohort_id: string; size: number }>(`/marketing/cohorts/${id}/size`),

  refreshMarketingCohort: (id: string) =>
    request<MarketingCohort>(`/marketing/cohorts/${id}/refresh`, { method: "POST" }),

  marketingMissedCalls: () =>
    request<MarketingMissedCallSummary>("/marketing/reports/missed-calls"),

  listMarketingCallbacks: (params?: { scope?: string; include_upcoming?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.include_upcoming) qs.set("include_upcoming", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<MarketingCallback[]>(`/marketing/callbacks${suffix}`);
  },

  marketingCallbackSummary: () => request<MarketingCallbackSummary>("/marketing/callbacks/summary"),

  listMarketingConsent: (contactId: string) =>
    request<MarketingConsentEntry[]>(`/marketing/contacts/${contactId}/consent`),

  recordMarketingConsent: (contactId: string, data: RecordMarketingConsentRequest) =>
    request<MarketingConsentEntry>(`/marketing/contacts/${contactId}/consent`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  withdrawMarketingConsent: (contactId: string, data: RecordMarketingConsentRequest) =>
    request<MarketingConsentEntry>(`/marketing/contacts/${contactId}/consent/withdraw`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMarketingSuppressions: () => request<MarketingSuppression[]>("/marketing/suppressions"),

  marketingPatientMatches: (contactId: string) =>
    request<MarketingPatientMatch[]>(`/marketing/contacts/${contactId}/patient-matches`),

  convertMarketingContact: (contactId: string, data: ConvertLeadRequest) =>
    request<ConvertLeadResponse>(`/marketing/contacts/${contactId}/convert`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addMarketingSuppression: (data: AddMarketingSuppressionRequest) =>
    request<MarketingSuppression>("/marketing/suppressions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeMarketingCallback: (id: string, data: { note?: string }) =>
    request<MarketingCallback>(`/marketing/callbacks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rescheduleMarketingCallback: (id: string, data: { due_at: string; note?: string }) =>
    request<MarketingCallback>(`/marketing/callbacks/${id}/reschedule`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  marketingCampaignFunnel: () =>
    request<MarketingCampaignFunnelRow[]>("/marketing/reports/campaign-funnel"),

  marketingFunnel: (params?: { from?: string; to?: string; exclude_backfill?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.exclude_backfill) qs.set("exclude_backfill", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<MarketingFunnelStageRow[]>(`/marketing/reports/funnel${suffix}`);
  },

  marketingChannelJourney: (params?: { from?: string; to?: string; area?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.area) qs.set("area", params.area);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<MarketingChannelJourneyRow[]>(`/marketing/reports/channel-journey${suffix}`);
  },

  listMarketingAreas: () => request<MarketingArea[]>("/marketing/areas"),

  upsertMarketingArea: (data: UpsertMarketingAreaRequest) =>
    request<MarketingArea>("/marketing/areas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMarketingDistributions: (params?: { campaign_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.campaign_id) qs.set("campaign_id", params.campaign_id);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<MarketingDistributionResult[]>(`/marketing/distributions${suffix}`);
  },

  createMarketingDistribution: (data: CreateMarketingDistributionRequest) =>
    request<{ id: string }>("/marketing/distributions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  marketingSendPolicy: () => request<MarketingSendPolicy>("/marketing/send-policy"),

  marketingWebForm: () => request<MarketingWebFormSetting>("/marketing/web-form"),

  updateMarketingWebForm: (data: MarketingWebFormSetting) =>
    request<MarketingWebFormSetting>("/marketing/web-form", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateMarketingSendPolicy: (data: MarketingSendPolicy) =>
    request<MarketingSendPolicy>("/marketing/send-policy", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  startMarketingOutreachRun: (id: string) =>
    request<MarketingDispatchResult>(`/marketing/outreach/${id}/start`, { method: "POST" }),

  listMarketingRunMessages: (id: string, params?: { blocked_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.blocked_only) qs.set("blocked_only", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<MarketingMessageRow[]>(`/marketing/outreach/${id}/messages${suffix}`);
  },

  marketingCampAcquisition: () =>
    request<MarketingCampAcquisitionRow[]>("/marketing/reports/camps"),

  linkCampAttendees: (campId: string) =>
    request<MarketingCampBridgeResult>(`/marketing/camps/${campId}/link-attendees`, {
      method: "POST",
    }),

  marketingAreaPerformance: () =>
    request<MarketingAreaPerformanceRow[]>("/marketing/reports/area-performance"),

  marketingAttribution: () =>
    request<MarketingCampaignAttributionRow[]>("/marketing/reports/attribution"),

  listMarketingTouchpoints: (contactId: string) =>
    request<MarketingTouchpoint[]>(`/marketing/contacts/${contactId}/touchpoints`),

  addMarketingTouchpoint: (contactId: string, data: AddMarketingTouchpointRequest) =>
    request<MarketingTouchpoint>(`/marketing/contacts/${contactId}/touchpoints`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
