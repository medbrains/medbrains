/** The `/patients` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AllergenCatalogEntry,
  ChartPage,
  ChartQuery,
  ContactChannel,
  CreateAllergyResponse,
  CreateDocumentRequest,
  CreateFamilyLinkRequest,
  CreatePatientAddressRequest,
  CreatePatientAllergyRequest,
  CreatePatientConsentRequest,
  CreatePatientContactRequest,
  CreatePatientIdentifierRequest,
  CreatePatientRequest,
  DpdpConsentInput,
  FamilyLinkRow,
  GroupCandidate,
  GroupCandidateDecision,
  GroupIdentity,
  GroupScanOutcome,
  GrowthResponse,
  MergePatientRequest,
  MpiMatchRequest,
  MpiMatchResult,
  Patient,
  PatientAccessLogRow,
  PatientAcquisition,
  PatientAddress,
  PatientAllergy,
  PatientAppointmentRow,
  PatientConsent,
  PatientConsultationHistoryRow,
  PatientContact,
  PatientContactConsents,
  PatientContext,
  PatientDataSummary,
  PatientDocument,
  PatientDpdpConsent,
  PatientFamilyLink,
  PatientIdentifier,
  PatientImmunization,
  PatientImmunizationSchedule,
  PatientInvoiceRow,
  PatientLabOrderRow,
  PatientListResponse,
  PatientMergeHistory,
  PatientTimelineEvent,
  PatientVisitRow,
  RecordPatientImmunization,
  UpdatePatientRequest,
  VerifyAllergyRequest,
  VteRiskAssessment,
} from "@medbrains/types";
import { request } from "../client.js";

export const patientsApi = {
  // Patient messaging consent (WhatsApp / email / SMS) — append-only history
  getPatientContactConsents: (patientId: string) =>
    request<PatientContactConsents>(`/patients/${patientId}/contact-consents`),
  setPatientContactConsent: (
    patientId: string,
    data: { channel: ContactChannel; granted: boolean },
  ) =>
    request<PatientContactConsents>(`/patients/${patientId}/contact-consents`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPatientDataSummary: (patientId: string) =>
    request<PatientDataSummary>(`/patients/${patientId}/data-summary`),
  getPatientDpdpConsent: (patientId: string) =>
    request<PatientDpdpConsent>(`/patients/${patientId}/dpdp-consent`),
  setPatientDpdpConsent: (patientId: string, data: DpdpConsentInput) =>
    request<PatientDpdpConsent>(`/patients/${patientId}/dpdp-consent`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Patients
  listPatients: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.order) qs.set("order", params.order);
    const query = qs.toString();
    return request<PatientListResponse>(`/patients${query ? `?${query}` : ""}`);
  },
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  getPatientContext: (id: string) => request<PatientContext>(`/patients/${id}/context`),
  getPatientClinicalTimeline: (id: string) =>
    request<PatientTimelineEvent[]>(`/patients/${id}/clinical-timeline`),
  createPatient: (data: CreatePatientRequest) =>
    request<Patient>("/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatient: (id: string, data: UpdatePatientRequest) =>
    request<Patient>(`/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Patient Visit History / Timeline
  listPatientVisits: (patientId: string) =>
    request<PatientVisitRow[]>(`/patients/${patientId}/visits`),
  listPatientConsultations: (patientId: string) =>
    request<PatientConsultationHistoryRow[]>(`/patients/${patientId}/consultations`),
  listPatientLabOrders: (patientId: string) =>
    request<PatientLabOrderRow[]>(`/patients/${patientId}/lab-orders`),
  listPatientInvoices: (patientId: string) =>
    request<PatientInvoiceRow[]>(`/patients/${patientId}/invoices`),
  listPatientAppointments: (patientId: string) =>
    request<PatientAppointmentRow[]>(`/patients/${patientId}/appointments`),

  // Patient Sub-resources
  listPatientIdentifiers: (patientId: string) =>
    request<PatientIdentifier[]>(`/patients/${patientId}/identifiers`),
  createPatientIdentifier: (patientId: string, data: CreatePatientIdentifierRequest) =>
    request<PatientIdentifier>(`/patients/${patientId}/identifiers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientIdentifier: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/identifiers/${id}`, {
      method: "DELETE",
    }),
  updatePatientIdentifier: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientIdentifier>(`/patients/${patientId}/identifiers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientAddresses: (patientId: string) =>
    request<PatientAddress[]>(`/patients/${patientId}/addresses`),
  createPatientAddress: (patientId: string, data: CreatePatientAddressRequest) =>
    request<PatientAddress>(`/patients/${patientId}/addresses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientAddress: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/addresses/${id}`, {
      method: "DELETE",
    }),
  updatePatientAddress: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientAddress>(`/patients/${patientId}/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientContacts: (patientId: string) =>
    request<PatientContact[]>(`/patients/${patientId}/contacts`),
  createPatientContact: (patientId: string, data: CreatePatientContactRequest) =>
    request<PatientContact>(`/patients/${patientId}/contacts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientContact: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/contacts/${id}`, {
      method: "DELETE",
    }),
  updatePatientContact: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientContact>(`/patients/${patientId}/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPatientAllergies: (patientId: string) =>
    request<PatientAllergy[]>(`/patients/${patientId}/allergies`),
  listAllergenCatalog: (allergyType?: string) =>
    request<AllergenCatalogEntry[]>(
      `/patients/allergen-catalog${allergyType ? `?allergy_type=${encodeURIComponent(allergyType)}` : ""}`,
    ),
  createPatientAllergy: (patientId: string, data: CreatePatientAllergyRequest) =>
    request<CreateAllergyResponse>(`/patients/${patientId}/allergies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyPatientAllergy: (patientId: string, id: string, data: VerifyAllergyRequest) =>
    request<PatientAllergy>(`/patients/${patientId}/allergies/${id}/verification`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updatePatientAllergy: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientAllergy>(`/patients/${patientId}/allergies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Patient Insurance
  listPatientInsurance: (patientId: string) =>
    request<Record<string, unknown>[]>(`/patients/${patientId}/insurance`),
  createPatientInsurance: (patientId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/patients/${patientId}/insurance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatientInsurance: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/patients/${patientId}/insurance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePatientInsurance: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/insurance/${id}`, {
      method: "DELETE",
    }),

  listPatientConsents: (patientId: string) =>
    request<PatientConsent[]>(`/patients/${patientId}/consents`),
  createPatientConsent: (patientId: string, data: CreatePatientConsentRequest) =>
    request<PatientConsent>(`/patients/${patientId}/consents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePatientConsent: (patientId: string, id: string, data: Record<string, unknown>) =>
    request<PatientConsent>(`/patients/${patientId}/consents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePatientConsent: (patientId: string, id: string) =>
    request<{ status: string }>(`/patients/${patientId}/consents/${id}`, {
      method: "DELETE",
    }),

  // The front desk's lookup. Unlike listPatients this is not scoped to the
  // caller's own patients: a returning patient gives a UHID or a phone number
  // and the desk has to find them whoever registered them. Identity only.
  findPatients: (q: string) =>
    request<MpiMatchResult[]>(`/patients/find?q=${encodeURIComponent(q)}`),
  transliterateName: (text: string, to: string) =>
    request<{ suggestions: string[] }>(
      `/patients/transliterate?text=${encodeURIComponent(text)}&to=${encodeURIComponent(to)}`,
    ),

  // MPI
  matchPatients: (data: MpiMatchRequest) =>
    request<MpiMatchResult[]>("/patients/match", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Group patient identity — linked across a hospital group, never merged
  getGroupIdentity: (patientId: string) =>
    request<GroupIdentity>(`/patients/${patientId}/group-identity`),
  scanGroupIdentity: (patientId: string) =>
    request<GroupScanOutcome>(`/patients/${patientId}/group-identity/scan`, { method: "POST" }),
  listGroupIdentityCandidates: (status: "pending" | "linked" | "rejected" = "pending") =>
    request<GroupCandidate[]>(`/patients/group-identity/candidates?status=${status}`),
  decideGroupIdentityCandidate: (id: string, data: GroupCandidateDecision) =>
    request<GroupCandidate>(`/patients/group-identity/candidates/${id}/decide`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unlinkGroupIdentity: (linkId: string, reason: string) =>
    request<{ unlinked: string }>(`/patients/group-identity/links/${linkId}/unlink`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // ── Patient: Merge ─────────────────────────────

  mergePatients: (data: MergePatientRequest) =>
    request<PatientMergeHistory>("/patients/merge", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unmergePatient: (mergeHistoryId: string) =>
    request<{ status: string }>(`/patients/unmerge/${mergeHistoryId}`, {
      method: "POST",
    }),
  listMergeHistory: (patientId: string) =>
    request<PatientMergeHistory[]>(`/patients/${patientId}/merge-history`),

  // ── Patient: Family Links ─────────────────────────────

  listFamilyLinks: (patientId: string) =>
    request<FamilyLinkRow[]>(`/patients/${patientId}/family-links`),
  createFamilyLink: (patientId: string, data: CreateFamilyLinkRequest) =>
    request<PatientFamilyLink>(`/patients/${patientId}/family-links`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteFamilyLink: (patientId: string, linkId: string) =>
    request<{ deleted: boolean }>(`/patients/${patientId}/family-links/${linkId}`, {
      method: "DELETE",
    }),

  // ── Patient: Documents ─────────────────────────────

  listPatientDocuments: (patientId: string) =>
    request<PatientDocument[]>(`/patients/${patientId}/documents`),
  listPatientAccessLog: (patientId: string) =>
    request<PatientAccessLogRow[]>(`/patients/${patientId}/access-log`),
  recordPatientAccess: (patientId: string, data: { access_type: string; notes?: string }) =>
    request<PatientAccessLogRow>(`/patients/${patientId}/access-log`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createPatientDocument: (patientId: string, data: CreateDocumentRequest) =>
    request<PatientDocument>(`/patients/${patientId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePatientDocument: (patientId: string, docId: string) =>
    request<{ deleted: boolean }>(`/patients/${patientId}/documents/${docId}`, {
      method: "DELETE",
    }),

  // ── Patient: Photo ─────────────────────────────

  updatePatientPhoto: (patientId: string, photoUrl: string) =>
    request<{ photo_url: string }>(`/patients/${patientId}/photo`, {
      method: "PATCH",
      body: JSON.stringify({ photo_url: photoUrl }),
    }),
  listPatientNotes: (patientId: string, query: ChartQuery = {}) => {
    const params = new URLSearchParams(
      Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    const qs = params.toString();
    return request<ChartPage>(`/patients/${patientId}/clinical-notes${qs ? `?${qs}` : ""}`);
  },
  getPatientAcquisition: (patientId: string) =>
    request<PatientAcquisition | null>(`/patients/${patientId}/acquisition`),
  /** Correct where a patient came from; audited. */
  correctPatientAcquisition: (patientId: string, data: { campaign_id: string | null }) =>
    request<PatientAcquisition | null>(`/patients/${patientId}/acquisition`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listVteAssessments: (patientId: string) =>
    request<VteRiskAssessment[]>(`/patients/${patientId}/vte-assessments`),
  /** WHO 0-5 y / IAP 2015 5-18 y growth charts, z-scores computed server-side. */
  getPatientGrowth: (patientId: string) => request<GrowthResponse>(`/patients/${patientId}/growth`),
  setPatientBirthGestation: (patientId: string, weeks: number | null) =>
    request<{ weeks: number | null }>(`/patients/${patientId}/growth/gestation`, {
      method: "PUT",
      body: JSON.stringify({ weeks }),
    }),
  listPatientImmunizations: (patientId: string) =>
    request<PatientImmunization[]>(`/patients/${patientId}/immunizations`),
  recordPatientImmunization: (patientId: string, data: RecordPatientImmunization) =>
    request<PatientImmunization>(`/patients/${patientId}/immunizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPatientImmunizationSchedule: (patientId: string) =>
    request<PatientImmunizationSchedule>(`/patients/${patientId}/immunization-schedule`),
  /** The desk completes a pharmacy customer's light record into a registration. */
  completePatientRegistration: (id: string) =>
    request<{ id: string; uhid: string }>(`/patients/${id}/complete-registration`, {
      method: "POST",
    }),
};
