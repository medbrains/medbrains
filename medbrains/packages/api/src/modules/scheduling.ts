/** The `/scheduling` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AutoFillResult,
  CreateBlockRequest,
  CreateOverbookingRuleRequest,
  CreateRecurringRequest,
  CreateWaitlistRequest,
  NoshowPredictionScore,
  NoshowRateRow,
  OfferSlotRequest,
  OverbookingRecommendation,
  PredictionAccuracyReport,
  RespondToOfferRequest,
  ScheduleAnalytics,
  SchedulingConflict,
  SchedulingOverbookingRule,
  SchedulingWaitlistEntry,
  ScoreAppointmentRequest,
  ScoreBatchRequest,
  UpdateOverbookingRuleRequest,
  UpdateWaitlistRequest,
  WaitlistStatsResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const schedulingApi = {
  // ══════════════════════════════════════════════════════════
  //  Scheduling / No-Show AI
  // ══════════════════════════════════════════════════════════

  listPredictions: (params?: {
    patient_id?: string;
    risk_level?: string;
    appointment_id?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.risk_level) sp.set("risk_level", params.risk_level);
    if (params?.appointment_id) sp.set("appointment_id", params.appointment_id);
    const qs = sp.toString();
    return request<NoshowPredictionScore[]>(`/scheduling/predictions${qs ? `?${qs}` : ""}`);
  },

  scoreAppointment: (data: ScoreAppointmentRequest) =>
    request<NoshowPredictionScore>("/scheduling/predictions/score", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  scoreBatch: (data: ScoreBatchRequest) =>
    request<NoshowPredictionScore[]>("/scheduling/predictions/score-batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listWaitlist: (params?: {
    doctor_id?: string;
    department_id?: string;
    status?: string;
    priority?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<SchedulingWaitlistEntry[]>(`/scheduling/waitlist${qs ? `?${qs}` : ""}`);
  },

  createWaitlistEntry: (data: CreateWaitlistRequest) =>
    request<SchedulingWaitlistEntry>("/scheduling/waitlist", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateWaitlistEntry: (id: string, data: UpdateWaitlistRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  offerSlot: (id: string, data: OfferSlotRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}/offer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  respondToOffer: (id: string, data: RespondToOfferRequest) =>
    request<SchedulingWaitlistEntry>(`/scheduling/waitlist/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  autoFillSlots: () => request<AutoFillResult>("/scheduling/auto-fill", { method: "POST" }),

  listOverbookingRules: (params?: {
    doctor_id?: string;
    department_id?: string;
    is_active?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.is_active) sp.set("is_active", params.is_active);
    const qs = sp.toString();
    return request<SchedulingOverbookingRule[]>(
      `/scheduling/overbooking-rules${qs ? `?${qs}` : ""}`,
    );
  },

  createOverbookingRule: (data: CreateOverbookingRuleRequest) =>
    request<SchedulingOverbookingRule>("/scheduling/overbooking-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOverbookingRule: (id: string, data: UpdateOverbookingRuleRequest) =>
    request<SchedulingOverbookingRule>(`/scheduling/overbooking-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOverbookingRule: (id: string) =>
    request<void>(`/scheduling/overbooking-rules/${id}`, { method: "DELETE" }),

  getOverbookingRecommendation: (params: {
    doctor_id: string;
    department_id: string;
    date: string;
  }) => {
    const sp = new URLSearchParams();
    sp.set("doctor_id", params.doctor_id);
    sp.set("department_id", params.department_id);
    sp.set("date", params.date);
    return request<OverbookingRecommendation>(
      `/scheduling/overbooking/recommendation?${sp.toString()}`,
    );
  },

  noshowRates: () => request<NoshowRateRow[]>("/scheduling/analytics/noshow-rates"),

  predictionAccuracy: () =>
    request<PredictionAccuracyReport>("/scheduling/analytics/prediction-accuracy"),

  waitlistStats: () => request<WaitlistStatsResponse>("/scheduling/analytics/waitlist-stats"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Scheduling (extended)
  // ══════════════════════════════════════════════════════════

  schedulingConflicts: () => request<SchedulingConflict[]>("/scheduling/conflicts"),

  promoteWaitlist: (data: { slot_id: string }) =>
    request<{ promoted: boolean }>("/scheduling/waitlist/promote", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  scheduleAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ScheduleAnalytics>(`/scheduling/analytics/overview${qs ? `?${qs}` : ""}`);
  },

  createRecurringAppointment: (data: CreateRecurringRequest) =>
    request<{ created: number }>("/scheduling/recurring", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createScheduleBlock: (data: CreateBlockRequest) =>
    request<{ success: true }>("/scheduling/blocks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
