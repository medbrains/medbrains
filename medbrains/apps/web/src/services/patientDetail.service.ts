import { api } from "@medbrains/api";

export type CreatePatientAllergyInput = Parameters<typeof api.createPatientAllergy>[1];
export type CreateFamilyLinkInput = Parameters<typeof api.createFamilyLink>[1];
export type CreatePatientDocumentInput = Parameters<typeof api.createPatientDocument>[1];
export type MergePatientsInput = Parameters<typeof api.mergePatients>[0];
export type ListPatientsInput = Parameters<typeof api.listPatients>[0];
export type DrugTimelineDateRangeInput = Parameters<typeof api.drugTimelineWithLabs>[1];

export const patientDetailService = {
  listImmunizations: (patientId: string) => api.listPatientImmunizations(patientId),
  getGrowth: (patientId: string) => api.getPatientGrowth(patientId),
  setBirthGestation: (patientId: string, weeks: number | null) =>
    api.setPatientBirthGestation(patientId, weeks),
  getImmunizationSchedule: (patientId: string) => api.getPatientImmunizationSchedule(patientId),
  recordImmunization: (...args: Parameters<typeof api.recordPatientImmunization>) =>
    api.recordPatientImmunization(...args),
  strikeImmunization: (id: string, reason: string) => api.strikePatientImmunization(id, reason),
  getPatient: (...args: Parameters<typeof api.getPatient>) => api.getPatient(...args),
  getPatientContactConsents: (...args: Parameters<typeof api.getPatientContactConsents>) =>
    api.getPatientContactConsents(...args),
  setPatientContactConsent: (...args: Parameters<typeof api.setPatientContactConsent>) =>
    api.setPatientContactConsent(...args),
  listPrivacyRequests: (...args: Parameters<typeof api.listPrivacyRequests>) =>
    api.listPrivacyRequests(...args),
  createPrivacyRequest: (...args: Parameters<typeof api.createPrivacyRequest>) =>
    api.createPrivacyRequest(...args),
  decidePrivacyRequest: (...args: Parameters<typeof api.decidePrivacyRequest>) =>
    api.decidePrivacyRequest(...args),
  getPatientDataSummary: (...args: Parameters<typeof api.getPatientDataSummary>) =>
    api.getPatientDataSummary(...args),
  getPatientDpdpConsent: (...args: Parameters<typeof api.getPatientDpdpConsent>) =>
    api.getPatientDpdpConsent(...args),
  setPatientDpdpConsent: (...args: Parameters<typeof api.setPatientDpdpConsent>) =>
    api.setPatientDpdpConsent(...args),
  getClinicalTimeline: (patientId: string) => api.getPatientClinicalTimeline(patientId),
  listRadiologyReports: (patientId: string) => api.listPatientRadiologyReports(patientId),
  // Every order for the patient, encounter or not — a desk walk-in included.
  listPatientRadiologyOrders: (patientId: string) =>
    api.listRadiologyOrders({ patient_id: patientId }),
  listPatientPharmacyOrders: (patientId: string) =>
    api.listPharmacyOrders({ patient_id: patientId }),
  acknowledgeRadiologyCriticalAlert: (alertId: string) =>
    api.acknowledgeRadiologyCriticalAlert(alertId),
  listPatients: (params: ListPatientsInput) => api.listPatients(params),
  listPatientAllergies: (...args: Parameters<typeof api.listPatientAllergies>) =>
    api.listPatientAllergies(...args),
  listAllergenCatalog: (...args: Parameters<typeof api.listAllergenCatalog>) =>
    api.listAllergenCatalog(...args),
  createPatientAllergy: (patientId: string, data: CreatePatientAllergyInput) =>
    api.createPatientAllergy(patientId, data),
  verifyPatientAllergy: (...args: Parameters<typeof api.verifyPatientAllergy>) =>
    api.verifyPatientAllergy(...args),
  listPatientVisits: (...args: Parameters<typeof api.listPatientVisits>) =>
    api.listPatientVisits(...args),
  listPatientPrescriptions: (...args: Parameters<typeof api.listPatientPrescriptions>) =>
    api.listPatientPrescriptions(...args),
  listPatientLabOrders: (...args: Parameters<typeof api.listPatientLabOrders>) =>
    api.listPatientLabOrders(...args),
  getPriorRadiologyDicomStudies: (...args: Parameters<typeof api.getPriorRadiologyDicomStudies>) =>
    api.getPriorRadiologyDicomStudies(...args),
  listPatientInvoices: (...args: Parameters<typeof api.listPatientInvoices>) =>
    api.listPatientInvoices(...args),
  listErVisits: (...args: Parameters<typeof api.listErVisits>) => api.listErVisits(...args),
  listCampRegistrations: (...args: Parameters<typeof api.listCampRegistrations>) =>
    api.listCampRegistrations(...args),
  listPatientAdmissions: (patientId: string, status?: string) =>
    api.listAdmissions({
      patient_id: patientId,
      ...(status ? { status } : {}),
    }),
  getAdmissionBillingSummary: (...args: Parameters<typeof api.getAdmissionBillingSummary>) =>
    api.getAdmissionBillingSummary(...args),
  getInvoicePrintData: (...args: Parameters<typeof api.getInvoicePrintData>) =>
    api.getInvoicePrintData(...args),
  getRegistrationCardPrintData: (...args: Parameters<typeof api.getRegistrationCardPrintData>) =>
    api.getRegistrationCardPrintData(...args),
  listPatientAppointments: (...args: Parameters<typeof api.listPatientAppointments>) =>
    api.listPatientAppointments(...args),
  listFamilyLinks: (...args: Parameters<typeof api.listFamilyLinks>) =>
    api.listFamilyLinks(...args),
  createFamilyLink: (patientId: string, data: CreateFamilyLinkInput) =>
    api.createFamilyLink(patientId, data),
  deleteFamilyLink: (...args: Parameters<typeof api.deleteFamilyLink>) =>
    api.deleteFamilyLink(...args),
  listPatientDocuments: (...args: Parameters<typeof api.listPatientDocuments>) =>
    api.listPatientDocuments(...args),
  listPatientAccessLog: (...args: Parameters<typeof api.listPatientAccessLog>) =>
    api.listPatientAccessLog(...args),
  createPatientDocument: (patientId: string, data: CreatePatientDocumentInput) =>
    api.createPatientDocument(patientId, data),
  deletePatientDocument: (...args: Parameters<typeof api.deletePatientDocument>) =>
    api.deletePatientDocument(...args),
  listMergeHistory: (...args: Parameters<typeof api.listMergeHistory>) =>
    api.listMergeHistory(...args),
  mergePatients: (data: MergePatientsInput) => api.mergePatients(data),
  unmergePatient: (...args: Parameters<typeof api.unmergePatient>) => api.unmergePatient(...args),
  drugTimelineWithLabs: (patientId: string, dateRange: DrugTimelineDateRangeInput) =>
    api.drugTimelineWithLabs(patientId, dateRange),
  listInteractionAlerts: (...args: Parameters<typeof api.listInteractionAlerts>) =>
    api.listInteractionAlerts(...args),
  treatmentSummary: (...args: Parameters<typeof api.treatmentSummary>) =>
    api.treatmentSummary(...args),
  outcomeDashboard: (...args: Parameters<typeof api.outcomeDashboard>) =>
    api.outcomeDashboard(...args),
  patientEnrollments: (...args: Parameters<typeof api.patientEnrollments>) =>
    api.patientEnrollments(...args),
  adherenceSummary: (...args: Parameters<typeof api.adherenceSummary>) =>
    api.adherenceSummary(...args),
};
