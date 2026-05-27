import { api } from "@medbrains/api";

export const opdService = {
  getEncounter: (...args: Parameters<typeof api.getEncounter>) => api.getEncounter(...args),
  getPatient: (...args: Parameters<typeof api.getPatient>) => api.getPatient(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
  listQueue: (...args: Parameters<typeof api.listQueue>) => api.listQueue(...args),
  listAppointments: (...args: Parameters<typeof api.listAppointments>) =>
    api.listAppointments(...args),
  createEncounter: (...args: Parameters<typeof api.createEncounter>) =>
    api.createEncounter(...args),
  callQueueEntry: (...args: Parameters<typeof api.callQueueEntry>) => api.callQueueEntry(...args),
  startConsultation: (...args: Parameters<typeof api.startConsultation>) =>
    api.startConsultation(...args),
  completeQueueEntry: (...args: Parameters<typeof api.completeQueueEntry>) =>
    api.completeQueueEntry(...args),
  markNoShow: (...args: Parameters<typeof api.markNoShow>) => api.markNoShow(...args),
  listVitals: (...args: Parameters<typeof api.listVitals>) => api.listVitals(...args),
  createVital: (...args: Parameters<typeof api.createVital>) => api.createVital(...args),
  createNurseVital: (...args: Parameters<typeof api.createNurseVital>) =>
    api.createNurseVital(...args),
  getConsultation: (...args: Parameters<typeof api.getConsultation>) =>
    api.getConsultation(...args),
  listDiagnoses: (...args: Parameters<typeof api.listDiagnoses>) => api.listDiagnoses(...args),
  listPrescriptions: (...args: Parameters<typeof api.listPrescriptions>) =>
    api.listPrescriptions(...args),
  listLabOrders: (...args: Parameters<typeof api.listLabOrders>) => api.listLabOrders(...args),
  listLabCatalog: (...args: Parameters<typeof api.listLabCatalog>) => api.listLabCatalog(...args),
  getTenantSettings: (...args: Parameters<typeof api.getTenantSettings>) =>
    api.getTenantSettings(...args),
  listPatientAllergies: (...args: Parameters<typeof api.listPatientAllergies>) =>
    api.listPatientAllergies(...args),
  listPatientPrescriptions: (...args: Parameters<typeof api.listPatientPrescriptions>) =>
    api.listPatientPrescriptions(...args),
  listPatientDiagnoses: (...args: Parameters<typeof api.listPatientDiagnoses>) =>
    api.listPatientDiagnoses(...args),
  opdPharmacyDispatchStatus: (...args: Parameters<typeof api.opdPharmacyDispatchStatus>) =>
    api.opdPharmacyDispatchStatus(...args),
  listConsultationTemplates: (...args: Parameters<typeof api.listConsultationTemplates>) =>
    api.listConsultationTemplates(...args),
  createConsultation: (...args: Parameters<typeof api.createConsultation>) =>
    api.createConsultation(...args),
  updateConsultation: (...args: Parameters<typeof api.updateConsultation>) =>
    api.updateConsultation(...args),
  createDiagnosis: (...args: Parameters<typeof api.createDiagnosis>) =>
    api.createDiagnosis(...args),
  updateDiagnosis: (...args: Parameters<typeof api.updateDiagnosis>) =>
    api.updateDiagnosis(...args),
  deleteDiagnosis: (...args: Parameters<typeof api.deleteDiagnosis>) =>
    api.deleteDiagnosis(...args),
  listPatientLabOrders: (...args: Parameters<typeof api.listPatientLabOrders>) =>
    api.listPatientLabOrders(...args),
  getPriorRadiologyDicomStudies: (...args: Parameters<typeof api.getPriorRadiologyDicomStudies>) =>
    api.getPriorRadiologyDicomStudies(...args),
  getLabOrder: (...args: Parameters<typeof api.getLabOrder>) => api.getLabOrder(...args),
  createLabOrder: (...args: Parameters<typeof api.createLabOrder>) => api.createLabOrder(...args),
  cancelLabOrder: (...args: Parameters<typeof api.cancelLabOrder>) => api.cancelLabOrder(...args),
  checkDuplicateOrders: (...args: Parameters<typeof api.checkDuplicateOrders>) =>
    api.checkDuplicateOrders(...args),
  getAvailableSlots: (...args: Parameters<typeof api.getAvailableSlots>) =>
    api.getAvailableSlots(...args),
  bookAppointment: (...args: Parameters<typeof api.bookAppointment>) =>
    api.bookAppointment(...args),
  createPrescription: (...args: Parameters<typeof api.createPrescription>) =>
    api.createPrescription(...args),
  updatePrescription: (...args: Parameters<typeof api.updatePrescription>) =>
    api.updatePrescription(...args),
  listCertificates: (...args: Parameters<typeof api.listCertificates>) =>
    api.listCertificates(...args),
  createCertificate: (...args: Parameters<typeof api.createCertificate>) =>
    api.createCertificate(...args),
  voidCertificate: (...args: Parameters<typeof api.voidCertificate>) =>
    api.voidCertificate(...args),
  getOpdCertificatePrintData: (...args: Parameters<typeof api.getOpdCertificatePrintData>) =>
    api.getOpdCertificatePrintData(...args),
  listPatientVitalsHistory: (...args: Parameters<typeof api.listPatientVitalsHistory>) =>
    api.listPatientVitalsHistory(...args),
  listPatientVisits: (...args: Parameters<typeof api.listPatientVisits>) =>
    api.listPatientVisits(...args),
  listPatientConsultations: (...args: Parameters<typeof api.listPatientConsultations>) =>
    api.listPatientConsultations(...args),
  listProcedureCatalog: (...args: Parameters<typeof api.listProcedureCatalog>) =>
    api.listProcedureCatalog(...args),
  listProcedureOrders: (...args: Parameters<typeof api.listProcedureOrders>) =>
    api.listProcedureOrders(...args),
  createProcedureOrder: (...args: Parameters<typeof api.createProcedureOrder>) =>
    api.createProcedureOrder(...args),
  cancelProcedureOrder: (...args: Parameters<typeof api.cancelProcedureOrder>) =>
    api.cancelProcedureOrder(...args),
  listPatientReferrals: (...args: Parameters<typeof api.listPatientReferrals>) =>
    api.listPatientReferrals(...args),
  createReferral: (...args: Parameters<typeof api.createReferral>) => api.createReferral(...args),
  listReminders: (...args: Parameters<typeof api.listReminders>) => api.listReminders(...args),
  createReminder: (...args: Parameters<typeof api.createReminder>) => api.createReminder(...args),
  completeReminder: (...args: Parameters<typeof api.completeReminder>) =>
    api.completeReminder(...args),
  cancelReminder: (...args: Parameters<typeof api.cancelReminder>) => api.cancelReminder(...args),
  listPatientFeedback: (...args: Parameters<typeof api.listPatientFeedback>) =>
    api.listPatientFeedback(...args),
  createFeedback: (...args: Parameters<typeof api.createFeedback>) => api.createFeedback(...args),
  listProcedureConsents: (...args: Parameters<typeof api.listProcedureConsents>) =>
    api.listProcedureConsents(...args),
  createProcedureConsent: (...args: Parameters<typeof api.createProcedureConsent>) =>
    api.createProcedureConsent(...args),
  signProcedureConsent: (...args: Parameters<typeof api.signProcedureConsent>) =>
    api.signProcedureConsent(...args),
  revokeProcedureConsent: (...args: Parameters<typeof api.revokeProcedureConsent>) =>
    api.revokeProcedureConsent(...args),
  getOpdConsentPrintData: (...args: Parameters<typeof api.getOpdConsentPrintData>) =>
    api.getOpdConsentPrintData(...args),
  getDoctorDocket: (...args: Parameters<typeof api.getDoctorDocket>) =>
    api.getDoctorDocket(...args),
  generateDoctorDocket: (...args: Parameters<typeof api.generateDoctorDocket>) =>
    api.generateDoctorDocket(...args),
  listPreAuthRequests: (...args: Parameters<typeof api.listPreAuthRequests>) =>
    api.listPreAuthRequests(...args),
  createPreAuthRequest: (...args: Parameters<typeof api.createPreAuthRequest>) =>
    api.createPreAuthRequest(...args),
  opdReferralTracking: (...args: Parameters<typeof api.opdReferralTracking>) =>
    api.opdReferralTracking(...args),
  opdFollowupCompliance: (...args: Parameters<typeof api.opdFollowupCompliance>) =>
    api.opdFollowupCompliance(...args),
  getWaitEstimate: (...args: Parameters<typeof api.getWaitEstimate>) =>
    api.getWaitEstimate(...args),
  listAvailableBeds: (...args: Parameters<typeof api.listAvailableBeds>) =>
    api.listAvailableBeds(...args),
  listWards: (...args: Parameters<typeof api.listWards>) => api.listWards(...args),
  admitFromOpd: (...args: Parameters<typeof api.admitFromOpd>) => api.admitFromOpd(...args),
  listDoctors: (...args: Parameters<typeof api.listDoctors>) => api.listDoctors(...args),
  bookAppointmentGroup: (...args: Parameters<typeof api.bookAppointmentGroup>) =>
    api.bookAppointmentGroup(...args),
};
