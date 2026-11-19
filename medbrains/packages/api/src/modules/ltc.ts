/** The `/ltc` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  FamilyMessage,
  HomeCareReferral,
  LtcMedication,
  MdsAssessment,
  ReadmissionRisk,
  RehabProgress,
  SnfAdmission,
} from "@medbrains/types";
import { request } from "../client.js";

export const ltcApi = {
  listMdsAssessments: (patientId: string) =>
    request<MdsAssessment[]>(`/ltc/mds?patient_id=${patientId}`),
  listLtcMedications: (patientId: string) =>
    request<LtcMedication[]>(`/ltc/medications?patient_id=${patientId}`),
  listRehabProgress: (patientId: string) =>
    request<RehabProgress[]>(`/ltc/rehab?patient_id=${patientId}`),
  listFamilyMessages: (patientId: string) =>
    request<FamilyMessage[]>(`/ltc/family-messages?patient_id=${patientId}`),
  listReadmissionRisk: (patientId: string) =>
    request<ReadmissionRisk[]>(`/ltc/readmission-risk?patient_id=${patientId}`),
  listHomeCareReferrals: (patientId: string) =>
    request<HomeCareReferral[]>(`/ltc/referrals?patient_id=${patientId}`),
  listSnfAdmissions: (patientId: string) =>
    request<SnfAdmission[]>(`/ltc/snf-admissions?patient_id=${patientId}`),
  createSnfAdmission: (data: {
    patient_id: string;
    source?: string;
    level_of_care?: string;
    primary_diagnosis?: string;
    care_plan?: string;
    expected_los_days?: number;
    notes?: string;
  }) =>
    request<SnfAdmission>("/ltc/snf-admissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSnfAdmission: (id: string, data: { status: string; care_plan?: string }) =>
    request<SnfAdmission>(`/ltc/snf-admissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createHomeCareReferral: (data: {
    patient_id: string;
    referral_type: string;
    reason?: string;
    provider?: string;
    notes?: string;
  }) => request<HomeCareReferral>("/ltc/referrals", { method: "POST", body: JSON.stringify(data) }),
  updateHomeCareReferral: (id: string, data: { status: string }) =>
    request<HomeCareReferral>(`/ltc/referrals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  assessReadmissionRisk: (data: {
    patient_id: string;
    length_of_stay: number;
    acuity_score: number;
    comorbidity_score: number;
    ed_visits: number;
    notes?: string;
  }) =>
    request<ReadmissionRisk>("/ltc/readmission-risk", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  postFamilyMessage: (data: {
    patient_id: string;
    direction?: string;
    message_type?: string;
    subject?: string;
    body: string;
    family_contact?: string;
  }) =>
    request<FamilyMessage>("/ltc/family-messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFamilyMessage: (id: string, data: { status: string }) =>
    request<FamilyMessage>(`/ltc/family-messages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addRehabProgress: (data: {
    patient_id: string;
    therapy_type: string;
    goal?: string;
    progress_note?: string;
    functional_score?: number;
  }) => request<RehabProgress>("/ltc/rehab", { method: "POST", body: JSON.stringify(data) }),
  addLtcMedication: (data: {
    patient_id: string;
    drug_name: string;
    dosage?: string;
    frequency?: string;
    supply_days?: number;
    auto_refill?: boolean;
    notes?: string;
  }) => request<LtcMedication>("/ltc/medications", { method: "POST", body: JSON.stringify(data) }),
  refillLtcMedication: (id: string) =>
    request<LtcMedication>(`/ltc/medications/${id}/refill`, { method: "POST" }),
  updateLtcMedication: (id: string, data: { status?: string; auto_refill?: boolean }) =>
    request<LtcMedication>(`/ltc/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createMdsAssessment: (data: {
    patient_id: string;
    assessment_type?: string;
    cognitive_status?: string;
    mood_score?: number;
    adl_dependency_score?: number;
    continence_status?: string;
    nutrition_notes?: string;
    notes?: string;
  }) => request<MdsAssessment>("/ltc/mds", { method: "POST", body: JSON.stringify(data) }),
  completeMdsAssessment: (id: string) =>
    request<MdsAssessment>(`/ltc/mds/${id}/complete`, { method: "POST" }),
};
