import { cdsApi } from "@medbrains/api/modules/cds";
import { ipdApi } from "@medbrains/api/modules/ipd";
import { labApi } from "@medbrains/api/modules/lab";
import { nurseApi } from "@medbrains/api/modules/nurse";
import { opdApi } from "@medbrains/api/modules/opd";
import { patientsApi } from "@medbrains/api/modules/patients";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { publicApi } from "@medbrains/api/modules/public";
import { radiologyApi } from "@medbrains/api/modules/radiology";
import { setupApi } from "@medbrains/api/modules/setup";

export const opdService = {
  getEncounter: (...args: Parameters<typeof opdApi.getEncounter>) => opdApi.getEncounter(...args),
  getLastOpdVisit: (patientId: string) => opdApi.getLastOpdVisit(patientId),
  getOpdAutoClose: () => opdApi.getOpdAutoClose(),
  updateOpdAutoClose: (data: Parameters<typeof opdApi.updateOpdAutoClose>[0]) =>
    opdApi.updateOpdAutoClose(data),
  opdReportSummary: (from: string, to: string) => opdApi.opdReportSummary(from, to),
  getRegistrationPolicy: () => opdApi.getRegistrationPolicy(),
  updateRegistrationPolicy: (data: Parameters<typeof opdApi.updateRegistrationPolicy>[0]) =>
    opdApi.updateRegistrationPolicy(data),
  getPatient: (...args: Parameters<typeof patientsApi.getPatient>) =>
    patientsApi.getPatient(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
  listQueue: (...args: Parameters<typeof opdApi.listQueue>) => opdApi.listQueue(...args),
  listAppointments: (...args: Parameters<typeof opdApi.listAppointments>) =>
    opdApi.listAppointments(...args),
  createEncounter: (...args: Parameters<typeof opdApi.createEncounter>) =>
    opdApi.createEncounter(...args),
  callQueueEntry: (...args: Parameters<typeof opdApi.callQueueEntry>) =>
    opdApi.callQueueEntry(...args),
  startConsultation: (...args: Parameters<typeof opdApi.startConsultation>) =>
    opdApi.startConsultation(...args),
  completeQueueEntry: (...args: Parameters<typeof opdApi.completeQueueEntry>) =>
    opdApi.completeQueueEntry(...args),
  markNoShow: (...args: Parameters<typeof opdApi.markNoShow>) => opdApi.markNoShow(...args),
  listVitals: (...args: Parameters<typeof opdApi.listVitals>) => opdApi.listVitals(...args),
  createVital: (...args: Parameters<typeof opdApi.createVital>) => opdApi.createVital(...args),
  createNurseVital: (...args: Parameters<typeof nurseApi.createNurseVital>) =>
    nurseApi.createNurseVital(...args),
  getConsultation: (...args: Parameters<typeof opdApi.getConsultation>) =>
    opdApi.getConsultation(...args),
  listDiagnoses: (...args: Parameters<typeof opdApi.listDiagnoses>) =>
    opdApi.listDiagnoses(...args),
  listPrescriptions: (...args: Parameters<typeof opdApi.listPrescriptions>) =>
    opdApi.listPrescriptions(...args),
  listLabOrders: (...args: Parameters<typeof labApi.listLabOrders>) =>
    labApi.listLabOrders(...args),
  listLabCatalog: (...args: Parameters<typeof labApi.listLabCatalog>) =>
    labApi.listLabCatalog(...args),
  getTenantSettings: (...args: Parameters<typeof setupApi.getTenantSettings>) =>
    setupApi.getTenantSettings(...args),
  listPatientAllergies: (...args: Parameters<typeof patientsApi.listPatientAllergies>) =>
    patientsApi.listPatientAllergies(...args),
  listPatientPrescriptions: (...args: Parameters<typeof opdApi.listPatientPrescriptions>) =>
    opdApi.listPatientPrescriptions(...args),
  listPatientDiagnoses: (...args: Parameters<typeof opdApi.listPatientDiagnoses>) =>
    opdApi.listPatientDiagnoses(...args),
  opdPharmacyDispatchStatus: (...args: Parameters<typeof opdApi.opdPharmacyDispatchStatus>) =>
    opdApi.opdPharmacyDispatchStatus(...args),
  listConsultationTemplates: (...args: Parameters<typeof opdApi.listConsultationTemplates>) =>
    opdApi.listConsultationTemplates(...args),
  createDiagnosis: (...args: Parameters<typeof opdApi.createDiagnosis>) =>
    opdApi.createDiagnosis(...args),
  updateDiagnosis: (...args: Parameters<typeof opdApi.updateDiagnosis>) =>
    opdApi.updateDiagnosis(...args),
  deleteDiagnosis: (...args: Parameters<typeof opdApi.deleteDiagnosis>) =>
    opdApi.deleteDiagnosis(...args),
  listPatientLabOrders: (...args: Parameters<typeof patientsApi.listPatientLabOrders>) =>
    patientsApi.listPatientLabOrders(...args),
  getPriorRadiologyDicomStudies: (
    ...args: Parameters<typeof radiologyApi.getPriorRadiologyDicomStudies>
  ) => radiologyApi.getPriorRadiologyDicomStudies(...args),
  getLabOrder: (...args: Parameters<typeof labApi.getLabOrder>) => labApi.getLabOrder(...args),
  createLabOrder: (...args: Parameters<typeof labApi.createLabOrder>) =>
    labApi.createLabOrder(...args),
  cancelLabOrder: (...args: Parameters<typeof labApi.cancelLabOrder>) =>
    labApi.cancelLabOrder(...args),
  checkDuplicateOrders: (...args: Parameters<typeof opdApi.checkDuplicateOrders>) =>
    opdApi.checkDuplicateOrders(...args),
  getAvailableSlots: (...args: Parameters<typeof opdApi.getAvailableSlots>) =>
    opdApi.getAvailableSlots(...args),
  bookAppointment: (...args: Parameters<typeof opdApi.bookAppointment>) =>
    opdApi.bookAppointment(...args),
  createPrescription: (...args: Parameters<typeof opdApi.createPrescription>) =>
    opdApi.createPrescription(...args),
  updatePrescription: (...args: Parameters<typeof opdApi.updatePrescription>) =>
    opdApi.updatePrescription(...args),
  listCertificates: (...args: Parameters<typeof opdApi.listCertificates>) =>
    opdApi.listCertificates(...args),
  createCertificate: (...args: Parameters<typeof opdApi.createCertificate>) =>
    opdApi.createCertificate(...args),
  voidCertificate: (...args: Parameters<typeof opdApi.voidCertificate>) =>
    opdApi.voidCertificate(...args),
  getOpdCertificatePrintData: (
    ...args: Parameters<typeof printDataApi.getOpdCertificatePrintData>
  ) => printDataApi.getOpdCertificatePrintData(...args),
  listPatientVitalsHistory: (...args: Parameters<typeof opdApi.listPatientVitalsHistory>) =>
    opdApi.listPatientVitalsHistory(...args),
  listPatientVisits: (...args: Parameters<typeof patientsApi.listPatientVisits>) =>
    patientsApi.listPatientVisits(...args),
  listPatientConsultations: (...args: Parameters<typeof patientsApi.listPatientConsultations>) =>
    patientsApi.listPatientConsultations(...args),
  listProcedureCatalog: (...args: Parameters<typeof opdApi.listProcedureCatalog>) =>
    opdApi.listProcedureCatalog(...args),
  listProcedureOrders: (...args: Parameters<typeof opdApi.listProcedureOrders>) =>
    opdApi.listProcedureOrders(...args),
  createProcedureOrder: (...args: Parameters<typeof opdApi.createProcedureOrder>) =>
    opdApi.createProcedureOrder(...args),
  cancelProcedureOrder: (...args: Parameters<typeof opdApi.cancelProcedureOrder>) =>
    opdApi.cancelProcedureOrder(...args),
  listPatientReferrals: (...args: Parameters<typeof opdApi.listPatientReferrals>) =>
    opdApi.listPatientReferrals(...args),
  createReferral: (...args: Parameters<typeof opdApi.createReferral>) =>
    opdApi.createReferral(...args),
  acceptReferral: (...args: Parameters<typeof opdApi.acceptReferral>) =>
    opdApi.acceptReferral(...args),
  declineReferral: (...args: Parameters<typeof opdApi.declineReferral>) =>
    opdApi.declineReferral(...args),
  completeReferral: (...args: Parameters<typeof opdApi.completeReferral>) =>
    opdApi.completeReferral(...args),
  cancelReferral: (...args: Parameters<typeof opdApi.cancelReferral>) =>
    opdApi.cancelReferral(...args),
  listReminders: (...args: Parameters<typeof opdApi.listReminders>) =>
    opdApi.listReminders(...args),
  createReminder: (...args: Parameters<typeof opdApi.createReminder>) =>
    opdApi.createReminder(...args),
  completeReminder: (...args: Parameters<typeof opdApi.completeReminder>) =>
    opdApi.completeReminder(...args),
  cancelReminder: (...args: Parameters<typeof opdApi.cancelReminder>) =>
    opdApi.cancelReminder(...args),
  listPatientFeedback: (...args: Parameters<typeof opdApi.listPatientFeedback>) =>
    opdApi.listPatientFeedback(...args),
  createFeedback: (...args: Parameters<typeof opdApi.createFeedback>) =>
    opdApi.createFeedback(...args),
  listProcedureConsents: (...args: Parameters<typeof opdApi.listProcedureConsents>) =>
    opdApi.listProcedureConsents(...args),
  createProcedureConsent: (...args: Parameters<typeof opdApi.createProcedureConsent>) =>
    opdApi.createProcedureConsent(...args),
  signProcedureConsent: (...args: Parameters<typeof opdApi.signProcedureConsent>) =>
    opdApi.signProcedureConsent(...args),
  revokeProcedureConsent: (...args: Parameters<typeof opdApi.revokeProcedureConsent>) =>
    opdApi.revokeProcedureConsent(...args),
  getOpdConsentPrintData: (...args: Parameters<typeof printDataApi.getOpdConsentPrintData>) =>
    printDataApi.getOpdConsentPrintData(...args),
  getOpdPrescriptionPrintData: (
    ...args: Parameters<typeof printDataApi.getOpdPrescriptionPrintData>
  ) => printDataApi.getOpdPrescriptionPrintData(...args),
  getDoctorDocket: (...args: Parameters<typeof opdApi.getDoctorDocket>) =>
    opdApi.getDoctorDocket(...args),
  generateDoctorDocket: (...args: Parameters<typeof opdApi.generateDoctorDocket>) =>
    opdApi.generateDoctorDocket(...args),
  listPreAuthRequests: (...args: Parameters<typeof cdsApi.listPreAuthRequests>) =>
    cdsApi.listPreAuthRequests(...args),
  createPreAuthRequest: (...args: Parameters<typeof cdsApi.createPreAuthRequest>) =>
    cdsApi.createPreAuthRequest(...args),
  opdReferralTracking: (...args: Parameters<typeof opdApi.opdReferralTracking>) =>
    opdApi.opdReferralTracking(...args),
  opdFollowupCompliance: (...args: Parameters<typeof opdApi.opdFollowupCompliance>) =>
    opdApi.opdFollowupCompliance(...args),
  issuePrescriptionVerifyLink: (...args: Parameters<typeof opdApi.issuePrescriptionVerifyLink>) =>
    opdApi.issuePrescriptionVerifyLink(...args),
  verifyPrescription: (...args: Parameters<typeof publicApi.verifyPrescription>) =>
    publicApi.verifyPrescription(...args),
  getWaitEstimate: (...args: Parameters<typeof opdApi.getWaitEstimate>) =>
    opdApi.getWaitEstimate(...args),
  listAvailableBeds: (...args: Parameters<typeof ipdApi.listAvailableBeds>) =>
    ipdApi.listAvailableBeds(...args),
  listWards: (...args: Parameters<typeof ipdApi.listWards>) => ipdApi.listWards(...args),
  admitFromOpd: (...args: Parameters<typeof opdApi.admitFromOpd>) => opdApi.admitFromOpd(...args),
  listDoctors: (...args: Parameters<typeof setupApi.listDoctors>) => setupApi.listDoctors(...args),
  bookAppointmentGroup: (...args: Parameters<typeof opdApi.bookAppointmentGroup>) =>
    opdApi.bookAppointmentGroup(...args),
};
