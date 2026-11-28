/** The `/home-health` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AdvanceDirective,
  BereavementFollowup,
  CaregiverEducation,
  HomeCarePackage,
  HomeDischargeItem,
  HomeEscalation,
  HomeMedAdministration,
  HomeVisit,
  HospiceEnrollment,
  RemoteVitalReading,
} from "@medbrains/types";
import { request } from "../client.js";

export const homeHealthApi = {
  listHomeMeds: (patientId: string) =>
    request<HomeMedAdministration[]>(`/home-health/medications?patient_id=${patientId}`),
  listRemoteVitals: (patientId: string) =>
    request<RemoteVitalReading[]>(`/home-health/remote-vitals?patient_id=${patientId}`),
  listHomeCarePackages: (patientId: string) =>
    request<HomeCarePackage[]>(`/home-health/packages?patient_id=${patientId}`),
  listCaregiverEducation: (patientId: string) =>
    request<CaregiverEducation[]>(`/home-health/caregiver-education?patient_id=${patientId}`),
  listHospiceEnrollments: (patientId: string) =>
    request<HospiceEnrollment[]>(`/home-health/hospice?patient_id=${patientId}`),
  listAdvanceDirectives: (patientId: string) =>
    request<AdvanceDirective[]>(`/home-health/advance-directives?patient_id=${patientId}`),
  listBereavement: (patientId: string) =>
    request<BereavementFollowup[]>(`/home-health/bereavement?patient_id=${patientId}`),
  scheduleBereavement: (data: {
    patient_id: string;
    family_contact_name: string;
    relationship?: string;
    contact_type?: string;
    scheduled_date: string;
    notes?: string;
  }) =>
    request<BereavementFollowup>("/home-health/bereavement", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createAdvanceDirective: (data: {
    patient_id: string;
    directive_type: string;
    content?: string;
    family_consent_obtained?: boolean;
    family_member_name?: string;
    family_relationship?: string;
    witnessed_by?: string;
    document_url?: string;
    notes?: string;
  }) =>
    request<AdvanceDirective>("/home-health/advance-directives", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  enrollHospice: (data: {
    patient_id: string;
    terminal_diagnosis?: string;
    prognosis?: string;
    comfort_care_plan?: string;
    dnr_confirmed?: boolean;
    primary_caregiver?: string;
    notes?: string;
  }) =>
    request<HospiceEnrollment>("/home-health/hospice", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordCaregiverEducation: (data: {
    patient_id: string;
    caregiver_name: string;
    relationship?: string;
    topic: string;
    materials_provided?: string;
    understanding_confirmed?: boolean;
    notes?: string;
  }) =>
    request<CaregiverEducation>("/home-health/caregiver-education", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createHomeCarePackage: (data: {
    patient_id: string;
    name: string;
    total_visits: number;
    price: number;
  }) =>
    request<HomeCarePackage>("/home-health/packages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  consumePackageVisit: (id: string) =>
    request<HomeCarePackage>(`/home-health/packages/${id}/consume`, { method: "POST" }),
  ingestRemoteVital: (data: {
    patient_id: string;
    device_type: string;
    reading: Record<string, number>;
    measured_at?: string;
    source?: string;
  }) =>
    request<RemoteVitalReading>("/home-health/remote-vitals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listHomeVisits: (params?: { date?: string; nurse_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set("date", params.date);
    if (params?.nurse_id) qs.set("nurse_id", params.nurse_id);
    const q = qs.toString();
    return request<HomeVisit[]>(`/home-health/visits${q ? `?${q}` : ""}`);
  },
  scheduleHomeVisit: (data: {
    patient_id: string;
    nurse_id?: string;
    scheduled_date: string;
    scheduled_time?: string;
    address?: string;
    purpose?: string;
    visit_order?: number;
  }) => request<HomeVisit>("/home-health/visits", { method: "POST", body: JSON.stringify(data) }),
  scheduleHomeMed: (data: {
    patient_id: string;
    drug_name: string;
    dose: string;
    route?: string;
    is_infusion?: boolean;
    infusion_rate?: string;
    scheduled_at: string;
  }) =>
    request<HomeMedAdministration>("/home-health/medications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordHomeMed: (
    id: string,
    data: { status?: string; administration_site?: string; notes?: string },
  ) =>
    request<HomeMedAdministration>(`/home-health/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listDischargeProgram: (patientId: string) =>
    request<HomeDischargeItem[]>(`/home-health/discharge-program?patient_id=${patientId}`),
  addDischargeItem: (data: {
    patient_id: string;
    item_type: string;
    title: string;
    description?: string;
  }) =>
    request<HomeDischargeItem>("/home-health/discharge-program", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  toggleDischargeItem: (id: string, isComplete: boolean) =>
    request<HomeDischargeItem>(`/home-health/discharge-program/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_complete: isComplete }),
    }),
  listEscalations: (patientId: string) =>
    request<HomeEscalation[]>(`/home-health/escalations?patient_id=${patientId}`),
  raiseEscalation: (data: {
    patient_id: string;
    reason: string;
    severity?: string;
    vital_details?: unknown;
  }) =>
    request<HomeEscalation>("/home-health/escalations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEscalation: (id: string, data: { status: string; notes?: string }) =>
    request<HomeEscalation>(`/home-health/escalations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
