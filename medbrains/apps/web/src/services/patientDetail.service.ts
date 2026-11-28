import { billingApi } from "@medbrains/api/modules/billing";
import { campApi } from "@medbrains/api/modules/camp";
import { chronicCareApi } from "@medbrains/api/modules/chronic-care";
import { emergencyApi } from "@medbrains/api/modules/emergency";
import { immunizationsApi } from "@medbrains/api/modules/immunizations";
import { ipdApi } from "@medbrains/api/modules/ipd";
import { opdApi } from "@medbrains/api/modules/opd";
import { patientsApi } from "@medbrains/api/modules/patients";
import { pharmacyApi } from "@medbrains/api/modules/pharmacy";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { privacyRequestsApi } from "@medbrains/api/modules/privacy-requests";
import { radiologyApi } from "@medbrains/api/modules/radiology";

export type CreatePatientAllergyInput = Parameters<typeof patientsApi.createPatientAllergy>[1];
export type CreateFamilyLinkInput = Parameters<typeof patientsApi.createFamilyLink>[1];
export type CreatePatientDocumentInput = Parameters<typeof patientsApi.createPatientDocument>[1];
export type MergePatientsInput = Parameters<typeof patientsApi.mergePatients>[0];
export type ListPatientsInput = Parameters<typeof patientsApi.listPatients>[0];
export type DrugTimelineDateRangeInput = Parameters<typeof chronicCareApi.drugTimelineWithLabs>[1];

export const patientDetailService = {
  listImmunizations: (patientId: string) => patientsApi.listPatientImmunizations(patientId),
  getGrowth: (patientId: string) => patientsApi.getPatientGrowth(patientId),
  setBirthGestation: (patientId: string, weeks: number | null) =>
    patientsApi.setPatientBirthGestation(patientId, weeks),
  getImmunizationSchedule: (patientId: string) =>
    patientsApi.getPatientImmunizationSchedule(patientId),
  recordImmunization: (...args: Parameters<typeof patientsApi.recordPatientImmunization>) =>
    patientsApi.recordPatientImmunization(...args),
  strikeImmunization: (id: string, reason: string) =>
    immunizationsApi.strikePatientImmunization(id, reason),
  getPatient: (...args: Parameters<typeof patientsApi.getPatient>) =>
    patientsApi.getPatient(...args),
  getPatientContactConsents: (...args: Parameters<typeof patientsApi.getPatientContactConsents>) =>
    patientsApi.getPatientContactConsents(...args),
  setPatientContactConsent: (...args: Parameters<typeof patientsApi.setPatientContactConsent>) =>
    patientsApi.setPatientContactConsent(...args),
  listPrivacyRequests: (...args: Parameters<typeof privacyRequestsApi.listPrivacyRequests>) =>
    privacyRequestsApi.listPrivacyRequests(...args),
  createPrivacyRequest: (...args: Parameters<typeof privacyRequestsApi.createPrivacyRequest>) =>
    privacyRequestsApi.createPrivacyRequest(...args),
  decidePrivacyRequest: (...args: Parameters<typeof privacyRequestsApi.decidePrivacyRequest>) =>
    privacyRequestsApi.decidePrivacyRequest(...args),
  getPatientDataSummary: (...args: Parameters<typeof patientsApi.getPatientDataSummary>) =>
    patientsApi.getPatientDataSummary(...args),
  getPatientDpdpConsent: (...args: Parameters<typeof patientsApi.getPatientDpdpConsent>) =>
    patientsApi.getPatientDpdpConsent(...args),
  setPatientDpdpConsent: (...args: Parameters<typeof patientsApi.setPatientDpdpConsent>) =>
    patientsApi.setPatientDpdpConsent(...args),
  getClinicalTimeline: (patientId: string) => patientsApi.getPatientClinicalTimeline(patientId),
  listRadiologyReports: (patientId: string) => radiologyApi.listPatientRadiologyReports(patientId),
  // Every order for the patient, encounter or not — a desk walk-in included.
  listPatientRadiologyOrders: (patientId: string) =>
    radiologyApi.listRadiologyOrders({ patient_id: patientId }),
  listPatientPharmacyOrders: (patientId: string) =>
    pharmacyApi.listPharmacyOrders({ patient_id: patientId }),
  acknowledgeRadiologyCriticalAlert: (alertId: string) =>
    radiologyApi.acknowledgeRadiologyCriticalAlert(alertId),
  listPatients: (params: ListPatientsInput) => patientsApi.listPatients(params),
  listPatientAllergies: (...args: Parameters<typeof patientsApi.listPatientAllergies>) =>
    patientsApi.listPatientAllergies(...args),
  listAllergenCatalog: (...args: Parameters<typeof patientsApi.listAllergenCatalog>) =>
    patientsApi.listAllergenCatalog(...args),
  createPatientAllergy: (patientId: string, data: CreatePatientAllergyInput) =>
    patientsApi.createPatientAllergy(patientId, data),
  verifyPatientAllergy: (...args: Parameters<typeof patientsApi.verifyPatientAllergy>) =>
    patientsApi.verifyPatientAllergy(...args),
  listPatientVisits: (...args: Parameters<typeof patientsApi.listPatientVisits>) =>
    patientsApi.listPatientVisits(...args),
  listPatientPrescriptions: (...args: Parameters<typeof opdApi.listPatientPrescriptions>) =>
    opdApi.listPatientPrescriptions(...args),
  listPatientLabOrders: (...args: Parameters<typeof patientsApi.listPatientLabOrders>) =>
    patientsApi.listPatientLabOrders(...args),
  getPriorRadiologyDicomStudies: (
    ...args: Parameters<typeof radiologyApi.getPriorRadiologyDicomStudies>
  ) => radiologyApi.getPriorRadiologyDicomStudies(...args),
  listPatientInvoices: (...args: Parameters<typeof patientsApi.listPatientInvoices>) =>
    patientsApi.listPatientInvoices(...args),
  listErVisits: (...args: Parameters<typeof emergencyApi.listErVisits>) =>
    emergencyApi.listErVisits(...args),
  listCampRegistrations: (...args: Parameters<typeof campApi.listCampRegistrations>) =>
    campApi.listCampRegistrations(...args),
  listPatientAdmissions: (patientId: string, status?: string) =>
    ipdApi.listAdmissions({
      patient_id: patientId,
      ...(status ? { status } : {}),
    }),
  getAdmissionBillingSummary: (...args: Parameters<typeof ipdApi.getAdmissionBillingSummary>) =>
    ipdApi.getAdmissionBillingSummary(...args),
  getInvoicePrintData: (...args: Parameters<typeof billingApi.getInvoicePrintData>) =>
    billingApi.getInvoicePrintData(...args),
  getRegistrationCardPrintData: (
    ...args: Parameters<typeof printDataApi.getRegistrationCardPrintData>
  ) => printDataApi.getRegistrationCardPrintData(...args),
  listPatientAppointments: (...args: Parameters<typeof patientsApi.listPatientAppointments>) =>
    patientsApi.listPatientAppointments(...args),
  listFamilyLinks: (...args: Parameters<typeof patientsApi.listFamilyLinks>) =>
    patientsApi.listFamilyLinks(...args),
  createFamilyLink: (patientId: string, data: CreateFamilyLinkInput) =>
    patientsApi.createFamilyLink(patientId, data),
  deleteFamilyLink: (...args: Parameters<typeof patientsApi.deleteFamilyLink>) =>
    patientsApi.deleteFamilyLink(...args),
  listPatientDocuments: (...args: Parameters<typeof patientsApi.listPatientDocuments>) =>
    patientsApi.listPatientDocuments(...args),
  listPatientAccessLog: (...args: Parameters<typeof patientsApi.listPatientAccessLog>) =>
    patientsApi.listPatientAccessLog(...args),
  createPatientDocument: (patientId: string, data: CreatePatientDocumentInput) =>
    patientsApi.createPatientDocument(patientId, data),
  deletePatientDocument: (...args: Parameters<typeof patientsApi.deletePatientDocument>) =>
    patientsApi.deletePatientDocument(...args),
  listMergeHistory: (...args: Parameters<typeof patientsApi.listMergeHistory>) =>
    patientsApi.listMergeHistory(...args),
  mergePatients: (data: MergePatientsInput) => patientsApi.mergePatients(data),
  unmergePatient: (...args: Parameters<typeof patientsApi.unmergePatient>) =>
    patientsApi.unmergePatient(...args),
  drugTimelineWithLabs: (patientId: string, dateRange: DrugTimelineDateRangeInput) =>
    chronicCareApi.drugTimelineWithLabs(patientId, dateRange),
  listInteractionAlerts: (...args: Parameters<typeof chronicCareApi.listInteractionAlerts>) =>
    chronicCareApi.listInteractionAlerts(...args),
  treatmentSummary: (...args: Parameters<typeof chronicCareApi.treatmentSummary>) =>
    chronicCareApi.treatmentSummary(...args),
  outcomeDashboard: (...args: Parameters<typeof chronicCareApi.outcomeDashboard>) =>
    chronicCareApi.outcomeDashboard(...args),
  patientEnrollments: (...args: Parameters<typeof chronicCareApi.patientEnrollments>) =>
    chronicCareApi.patientEnrollments(...args),
  adherenceSummary: (...args: Parameters<typeof chronicCareApi.adherenceSummary>) =>
    chronicCareApi.adherenceSummary(...args),
};
