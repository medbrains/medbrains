/** The `/clinical-trials` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ClinicalTrial,
  TrialAdverseEvent,
  TrialCandidate,
  TrialConsent,
  TrialIrbSubmission,
  TrialRandomization,
  TrialVisit,
} from "@medbrains/types";
import { request } from "../client.js";

export const clinicalTrialsApi = {
  listClinicalTrials: (status?: string) =>
    request<ClinicalTrial[]>(`/clinical-trials${status ? `?status=${status}` : ""}`),
  getClinicalTrial: (id: string) => request<ClinicalTrial>(`/clinical-trials/${id}`),
  createClinicalTrial: (data: {
    protocol_number: string;
    title: string;
    sponsor?: string;
    phase?: string;
    status?: string;
    indication?: string;
    principal_investigator?: string;
    target_enrollment?: number;
  }) => request<ClinicalTrial>("/clinical-trials", { method: "POST", body: JSON.stringify(data) }),
  updateClinicalTrial: (
    id: string,
    data: {
      status?: string;
      notes?: string;
      min_age?: number;
      max_age?: number;
      eligibility_sex?: string;
      diagnosis_codes?: string[];
    },
  ) =>
    request<ClinicalTrial>(`/clinical-trials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  screenTrialCandidates: (id: string) =>
    request<TrialCandidate[]>(`/clinical-trials/${id}/candidates`),
  listTrialConsents: (trialId: string) =>
    request<TrialConsent[]>(`/clinical-trials/${trialId}/consents`),
  listTrialVisits: (trialId: string) => request<TrialVisit[]>(`/clinical-trials/${trialId}/visits`),
  listAdverseEvents: (trialId: string) =>
    request<TrialAdverseEvent[]>(`/clinical-trials/${trialId}/adverse-events`),
  listRandomizations: (trialId: string) =>
    request<TrialRandomization[]>(`/clinical-trials/${trialId}/randomizations`),
  listIrbSubmissions: (trialId: string) =>
    request<TrialIrbSubmission[]>(`/clinical-trials/${trialId}/irb`),
  exportTrial: (trialId: string) =>
    request<Record<string, unknown>>(`/clinical-trials/${trialId}/export`),
  createIrbSubmission: (
    trialId: string,
    data: {
      submission_type?: string;
      committee_name?: string;
      reference_number?: string;
      notes?: string;
    },
  ) =>
    request<TrialIrbSubmission>(`/clinical-trials/${trialId}/irb`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  randomizePatient: (
    trialId: string,
    data: { patient_id: string; arm: string; randomization_code?: string },
  ) =>
    request<TrialRandomization>(`/clinical-trials/${trialId}/randomizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reportAdverseEvent: (
    trialId: string,
    data: {
      patient_id: string;
      event_term: string;
      onset_date?: string;
      severity?: string;
      is_serious?: boolean;
      relatedness?: string;
      outcome?: string;
      description?: string;
    },
  ) =>
    request<TrialAdverseEvent>(`/clinical-trials/${trialId}/adverse-events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  scheduleTrialVisit: (
    trialId: string,
    data: { patient_id: string; visit_name: string; scheduled_date: string; procedures?: string },
  ) =>
    request<TrialVisit>(`/clinical-trials/${trialId}/visits`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordTrialConsent: (trialId: string, data: { patient_id: string; template_id?: string }) =>
    request<TrialConsent>(`/clinical-trials/${trialId}/consents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
