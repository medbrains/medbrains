import { consentApi } from "@medbrains/api/modules/consent";

export const consentService = {
  listConsentTemplates: (...args: Parameters<typeof consentApi.listConsentTemplates>) =>
    consentApi.listConsentTemplates(...args),
  getConsentTemplate: (...args: Parameters<typeof consentApi.getConsentTemplate>) =>
    consentApi.getConsentTemplate(...args),
  createConsentTemplate: (...args: Parameters<typeof consentApi.createConsentTemplate>) =>
    consentApi.createConsentTemplate(...args),
  updateConsentTemplate: (...args: Parameters<typeof consentApi.updateConsentTemplate>) =>
    consentApi.updateConsentTemplate(...args),
  deleteConsentTemplate: (...args: Parameters<typeof consentApi.deleteConsentTemplate>) =>
    consentApi.deleteConsentTemplate(...args),
  listConsentAudit: (...args: Parameters<typeof consentApi.listConsentAudit>) =>
    consentApi.listConsentAudit(...args),
  verifyConsent: (...args: Parameters<typeof consentApi.verifyConsent>) =>
    consentApi.verifyConsent(...args),
  getPatientConsentSummary: (...args: Parameters<typeof consentApi.getPatientConsentSummary>) =>
    consentApi.getPatientConsentSummary(...args),
  revokeConsent: (...args: Parameters<typeof consentApi.revokeConsent>) =>
    consentApi.revokeConsent(...args),
  listConsentSignatures: (...args: Parameters<typeof consentApi.listConsentSignatures>) =>
    consentApi.listConsentSignatures(...args),
  createConsentSignature: (...args: Parameters<typeof consentApi.createConsentSignature>) =>
    consentApi.createConsentSignature(...args),
  deleteConsentSignature: (...args: Parameters<typeof consentApi.deleteConsentSignature>) =>
    consentApi.deleteConsentSignature(...args),
};
