/** The `/ot` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AnesthesiaComplicationEntry,
  CreateAnesthesiaRecordRequest,
  CreateCaseRecordRequest,
  CreateOtBookingRequest,
  CreateOtRoomRequest,
  CreatePostopRecordRequest,
  CreatePreopAssessmentRequest,
  CreateSafetyChecklistRequest,
  CreateSurgeonPreferenceRequest,
  OtAnesthesiaRecord,
  OtBooking,
  OtBookingConsents,
  OtBookingListResponse,
  OtCaseRecord,
  OtPostopHandoff,
  OtPostopRecord,
  OtPreopAssessment,
  OtPreopHandoff,
  OtRoom,
  OtSurgeonPreference,
  OtSurgicalSafetyChecklist,
  RoomUtilization,
  SurgeonCaseloadEntry,
  UpdateAnesthesiaRecordRequest,
  UpdateCaseRecordRequest,
  UpdateOtBookingRequest,
  UpdateOtBookingStatusRequest,
  UpdateOtRoomRequest,
  UpdatePostopRecordRequest,
  UpdatePreopAssessmentRequest,
  UpdateSafetyChecklistRequest,
  UpdateSurgeonPreferenceRequest,
  UpsertPreopHandoffInput,
} from "@medbrains/types";
import { request } from "../client.js";

export const otApi = {
  // ── Operation Theatre (OT) ────────────────────────────────

  // OT Rooms
  listOtRooms: () => request<OtRoom[]>("/ot/rooms"),
  createOtRoom: (data: CreateOtRoomRequest) =>
    request<OtRoom>("/ot/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateOtRoom: (id: string, data: UpdateOtRoomRequest) =>
    request<OtRoom>(`/ot/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // OT Bookings
  listOtBookings: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtBookingListResponse>(`/ot/bookings${qs}`);
  },
  getOtBooking: (id: string) => request<OtBooking>(`/ot/bookings/${id}`),
  getOtBookingConsents: (bookingId: string) =>
    request<OtBookingConsents>(`/ot/bookings/${bookingId}/consents`),
  linkOtBookingConsent: (bookingId: string, consentId: string) =>
    request<OtBookingConsents>(`/ot/bookings/${bookingId}/consents`, {
      method: "POST",
      body: JSON.stringify({ consent_id: consentId }),
    }),
  unlinkOtBookingConsent: (bookingId: string, consentId: string, reason: string) =>
    request<OtBookingConsents>(`/ot/bookings/${bookingId}/consents/${consentId}/unlink`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  certifyOtEmergencyConsent: (bookingId: string, reason?: string) =>
    request<OtBookingConsents>(`/ot/bookings/${bookingId}/emergency-consent`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  createOtBooking: (data: CreateOtBookingRequest) =>
    request<OtBooking>("/ot/bookings", { method: "POST", body: JSON.stringify(data) }),
  updateOtBooking: (id: string, data: UpdateOtBookingRequest) =>
    request<OtBooking>(`/ot/bookings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateOtBookingStatus: (id: string, data: UpdateOtBookingStatusRequest) =>
    request<OtBooking>(`/ot/bookings/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),
  cancelOtBooking: (id: string, data: { cancellation_reason?: string }) =>
    request<OtBooking>(`/ot/bookings/${id}/status`, { method: "PUT", body: JSON.stringify(data) }),

  // OT Pre-op
  listPreopAssessments: (bookingId: string) =>
    request<OtPreopAssessment[]>(`/ot/bookings/${bookingId}/preop`),
  createPreopAssessment: (bookingId: string, data: CreatePreopAssessmentRequest) =>
    request<OtPreopAssessment>(`/ot/bookings/${bookingId}/preop`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePreopAssessment: (bookingId: string, data: UpdatePreopAssessmentRequest) =>
    request<OtPreopAssessment>(`/ot/bookings/${bookingId}/preop`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPreopHandoff: (bookingId: string) =>
    request<OtPreopHandoff | null>(`/ot/bookings/${bookingId}/preop-handoff`),
  upsertPreopHandoff: (bookingId: string, data: UpsertPreopHandoffInput) =>
    request<OtPreopHandoff>(`/ot/bookings/${bookingId}/preop-handoff`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPostopHandoff: (bookingId: string) =>
    request<OtPostopHandoff | null>(`/ot/bookings/${bookingId}/postop-handoff`),
  upsertPostopHandoff: (bookingId: string, data: UpsertPreopHandoffInput) =>
    request<OtPostopHandoff>(`/ot/bookings/${bookingId}/postop-handoff`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Safety Checklist
  listSafetyChecklists: (bookingId: string) =>
    request<OtSurgicalSafetyChecklist[]>(`/ot/bookings/${bookingId}/checklists`),
  createSafetyChecklist: (bookingId: string, data: CreateSafetyChecklistRequest) =>
    request<OtSurgicalSafetyChecklist>(`/ot/bookings/${bookingId}/checklists`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSafetyChecklist: (bookingId: string, id: string, data: UpdateSafetyChecklistRequest) =>
    request<OtSurgicalSafetyChecklist>(`/ot/bookings/${bookingId}/checklists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Case Record
  getCaseRecord: (bookingId: string) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`),
  createCaseRecord: (bookingId: string, data: CreateCaseRecordRequest) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCaseRecord: (bookingId: string, data: UpdateCaseRecordRequest) =>
    request<OtCaseRecord>(`/ot/bookings/${bookingId}/case-record`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Anesthesia
  getAnesthesiaRecord: (bookingId: string) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`),
  createAnesthesiaRecord: (bookingId: string, data: CreateAnesthesiaRecordRequest) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAnesthesiaRecord: (bookingId: string, data: UpdateAnesthesiaRecordRequest) =>
    request<OtAnesthesiaRecord>(`/ot/bookings/${bookingId}/anesthesia`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Post-op
  getPostopRecord: (bookingId: string) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`),
  createPostopRecord: (bookingId: string, data: CreatePostopRecordRequest) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePostopRecord: (bookingId: string, data: UpdatePostopRecordRequest) =>
    request<OtPostopRecord>(`/ot/bookings/${bookingId}/postop`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // OT Surgeon Preferences
  listSurgeonPreferences: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtSurgeonPreference[]>(`/ot/surgeon-preferences${qs}`);
  },
  createSurgeonPreference: (data: CreateSurgeonPreferenceRequest) =>
    request<OtSurgeonPreference>("/ot/surgeon-preferences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSurgeonPreference: (id: string, data: UpdateSurgeonPreferenceRequest) =>
    request<OtSurgeonPreference>(`/ot/surgeon-preferences/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSurgeonPreference: (id: string) =>
    request<void>(`/ot/surgeon-preferences/${id}`, { method: "DELETE" }),

  // OT Schedule
  getOtSchedule: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<OtBooking[]>(`/ot/schedule${qs}`);
  },

  // OT Analytics
  otUtilization: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<RoomUtilization[]>(`/ot/analytics/utilization${qs ? `?${qs}` : ""}`);
  },

  getSurgeonCaseload: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<SurgeonCaseloadEntry[]>(`/ot/analytics/surgeon-caseload${qs ? `?${qs}` : ""}`);
  },

  listAnesthesiaComplications: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<AnesthesiaComplicationEntry[]>(
      `/ot/analytics/anesthesia-complications${qs ? `?${qs}` : ""}`,
    );
  },
};
