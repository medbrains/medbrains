/** The `/nurse` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AcknowledgeEwsRequest,
  CodeBlueEventRow,
  CodeBlueResponder,
  CodeTeamRoster,
  CodeTeamTier,
  CreatedVital,
  CreateNurseRosterEntryRequest,
  CreateVitalRequest,
  EwsEscalation,
  EwsPlan,
  EwsPolicy,
  EwsScoringInputs,
  MonitorReading,
  NurseRosterCandidate,
  NurseRosterEntry,
  ScoredVital,
  SetEwsPlanRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const nurseApi = {
  /** Monitor readings waiting for a nurse, newest first. */
  listMonitorReadings: (encounterId: string) =>
    request<MonitorReading[]>(`/nurse/encounters/${encounterId}/monitor-readings`),
  confirmMonitorReading: (id: string, data: EwsScoringInputs & { notes?: string }) =>
    request<CreatedVital>(`/nurse/monitor-readings/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  discardMonitorReading: (id: string, reason: string) =>
    request<{ status: string }>(`/nurse/monitor-readings/${id}/discard`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  createNurseVital: (data: CreateVitalRequest & { encounter_id: string }) =>
    request<CreatedVital>("/nurse/vitals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNurseVitals: (encounterId: string) =>
    request<ScoredVital[]>(`/nurse/vitals/encounter/${encounterId}`),
  listEwsEscalations: (params?: { status?: "open" | "acknowledged" | "all"; ward_id?: string }) => {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return request<EwsEscalation[]>(`/nurse/ews/escalations${qs}`);
  },
  acknowledgeEwsEscalation: (id: string, data: AcknowledgeEwsRequest) =>
    request<EwsEscalation>(`/nurse/ews/escalations/${id}/acknowledge`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getEwsPlan: (encounterId: string) => request<EwsPlan>(`/nurse/ews/plan/${encounterId}`),
  setEwsPlan: (encounterId: string, data: SetEwsPlanRequest) =>
    request<EwsPlan>(`/nurse/ews/plan/${encounterId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getEwsPolicy: () => request<EwsPolicy>("/nurse/ews/policy"),
  setEwsPolicy: (data: EwsPolicy) =>
    request<EwsPolicy>("/nurse/ews/policy", { method: "PUT", body: JSON.stringify(data) }),
  listNurseRoster: (params?: { ward_id?: string; shift_date?: string }) => {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return request<NurseRosterEntry[]>(`/nurse/roster${qs}`);
  },
  createNurseRosterEntry: (data: CreateNurseRosterEntryRequest) =>
    request<{ id: string }>("/nurse/roster", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteNurseRosterEntry: (id: string) =>
    request<{ id: string }>(`/nurse/roster/${id}`, { method: "DELETE" }),
  /** Nurses who can be rostered; gated on roster.manage, not the user directory. */
  listNurseRosterCandidates: () => request<NurseRosterCandidate[]>("/nurse/roster/candidates"),

  // ══════════════════════════════════════════════════════════════════
  // Nurse Activities
  // ══════════════════════════════════════════════════════════════════

  // MAR (canonical ipd_medication_administration)
  listMarDueNow: (params?: { window_min?: number; ward_id?: string; patient_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.window_min !== undefined) qs.set("window_min", String(params.window_min));
    if (params?.ward_id) qs.set("ward_id", params.ward_id);
    if (params?.patient_id) qs.set("patient_id", params.patient_id);
    const q = qs.toString();
    return request<unknown[]>(`/nurse/mar/due-now${q ? `?${q}` : ""}`);
  },
  updateMarRound: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/nurse/mar/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  verifyMarBarcode: (id: string, data: { patient_barcode: string; drug_barcode: string }) =>
    request<{
      verified: boolean;
      right_patient: boolean;
      right_drug: boolean;
      reason: string | null;
    }>(`/nurse/mar/${id}/verify-barcode`, { method: "POST", body: JSON.stringify(data) }),
  listMarForPatient: (patient_id: string) => request<unknown[]>(`/nurse/mar/patient/${patient_id}`),

  // Vitals schedules
  listVitalsSchedules: (params?: { encounter_id?: string; due_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.encounter_id) qs.set("encounter_id", params.encounter_id);
    if (params?.due_only) qs.set("due_only", "true");
    const q = qs.toString();
    return request<unknown[]>(`/nurse/vitals-schedules${q ? `?${q}` : ""}`);
  },
  createVitalsSchedule: (data: { encounter_id: string; frequency_minutes: number }) =>
    request<unknown>("/nurse/vitals-schedules", { method: "POST", body: JSON.stringify(data) }),
  endVitalsSchedule: (id: string) =>
    request<unknown>(`/nurse/vitals-schedules/${id}/end`, { method: "PUT" }),

  // Intake/Output
  createIoEntry: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/io-entries", { method: "POST", body: JSON.stringify(data) }),
  listIoForEncounter: (encounter_id: string) =>
    request<unknown[]>(`/nurse/io-entries/encounter/${encounter_id}`),
  getEncounterIoBalance: (encounter_id: string, since_hours?: number) => {
    const qs = since_hours !== undefined ? `?since_hours=${since_hours}` : "";
    return request<unknown>(`/nurse/io-entries/encounter/${encounter_id}/balance${qs}`);
  },

  // Pain
  createPainEntry: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/pain-entries", { method: "POST", body: JSON.stringify(data) }),
  listPainForEncounter: (encounter_id: string) =>
    request<unknown[]>(`/nurse/pain-entries/encounter/${encounter_id}`),

  // Fall risk
  createFallRisk: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/fall-risk", { method: "POST", body: JSON.stringify(data) }),
  listFallRiskForEncounter: (encounter_id: string) =>
    request<unknown[]>(`/nurse/fall-risk/encounter/${encounter_id}`),

  // Restraint
  createRestraintEvent: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/restraint-events", { method: "POST", body: JSON.stringify(data) }),
  listRestraintForOrder: (restraint_order_id: string) =>
    request<unknown[]>(`/nurse/restraint-events/order/${restraint_order_id}`),

  // Wound
  createWound: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/wounds", { method: "POST", body: JSON.stringify(data) }),
  listWoundsForEncounter: (encounter_id: string) =>
    request<unknown[]>(`/nurse/wounds/encounter/${encounter_id}`),

  // Handoff (SBAR)
  createHandoff: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/handoffs", { method: "POST", body: JSON.stringify(data) }),
  acceptHandoff: (id: string) =>
    request<unknown>(`/nurse/handoffs/${id}/accept`, { method: "PUT" }),
  listHandoffsForEncounter: (encounter_id: string) =>
    request<unknown[]>(`/nurse/handoffs/encounter/${encounter_id}`),

  // Code Blue
  listCodeBlue: (params?: { active_only?: boolean; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.active_only) qs.set("active_only", "true");
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<CodeBlueEventRow[]>(`/nurse/code-blue${q ? `?${q}` : ""}`);
  },
  /** The code-blue roster, who can be added, and the re-page settings. */
  getCodeBlueTeam: () => request<CodeTeamRoster>("/nurse/code-blue/team"),
  addCodeBlueTeamMember: (data: { user_id: string; tier: CodeTeamTier; code_type: string }) =>
    request<{ id: string }>("/nurse/code-blue/team", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeCodeBlueTeamMember: (id: string) =>
    request<{ removed: boolean }>(`/nurse/code-blue/team/${id}`, { method: "DELETE" }),
  updateCodeBlueTeamSettings: (data: { response_secs: number; max_rounds: number }) =>
    request<{ updated: boolean }>("/nurse/code-blue/team/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  startCodeBlue: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/code-blue", { method: "POST", body: JSON.stringify(data) }),
  appendCodeBlueEntry: (id: string, data: { field: string; entry: unknown }) =>
    request<unknown>(`/nurse/code-blue/${id}/append`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  endCodeBlue: (id: string, data: { outcome: string; notes?: string }) =>
    request<unknown>(`/nurse/code-blue/${id}/end`, { method: "PUT", body: JSON.stringify(data) }),
  /** Who has answered every code blue still in progress — one call for the screen. */
  listCodeBlueResponders: () => request<CodeBlueResponder[]>("/nurse/code-blue/responders"),
  /** Say you are on your way. Idempotent; the first response is the team's arrival. */
  respondToCodeBlue: (id: string) =>
    request<{ code_blue_id: string; responded: boolean }>(`/nurse/code-blue/${id}/respond`, {
      method: "POST",
    }),

  // Equipment checks
  listEquipmentChecks: (params?: {
    location_id?: string;
    overdue_only?: boolean;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.location_id) qs.set("location_id", params.location_id);
    if (params?.overdue_only) qs.set("overdue_only", "true");
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/nurse/equipment-checks${q ? `?${q}` : ""}`);
  },
  createEquipmentCheck: (data: Record<string, unknown>) =>
    request<unknown>("/nurse/equipment-checks", { method: "POST", body: JSON.stringify(data) }),
};
