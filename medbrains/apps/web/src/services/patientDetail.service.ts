import { api } from "@medbrains/api";

export type CreatePatientAllergyInput = Parameters<typeof api.createPatientAllergy>[1];
export type CreateFamilyLinkInput = Parameters<typeof api.createFamilyLink>[1];
export type CreatePatientDocumentInput = Parameters<typeof api.createPatientDocument>[1];
export type MergePatientsInput = Parameters<typeof api.mergePatients>[0];
export type ListPatientsInput = Parameters<typeof api.listPatients>[0];
export type DrugTimelineDateRangeInput = Parameters<typeof api.drugTimelineWithLabs>[1];

export const patientDetailService = {
  getPatient: (...args: Parameters<typeof api.getPatient>) => api.getPatient(...args),
  listPatients: (params: ListPatientsInput) => api.listPatients(params),
  listPatientAllergies: (...args: Parameters<typeof api.listPatientAllergies>) =>
    api.listPatientAllergies(...args),
  createPatientAllergy: (patientId: string, data: CreatePatientAllergyInput) =>
    api.createPatientAllergy(patientId, data),
  deletePatientAllergy: (...args: Parameters<typeof api.deletePatientAllergy>) =>
    api.deletePatientAllergy(...args),
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
