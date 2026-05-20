import { api } from "@medbrains/api";

export const consentService = {
  listConsentTemplates: (...args: Parameters<typeof api.listConsentTemplates>) =>
    api.listConsentTemplates(...args),
  createConsentTemplate: (...args: Parameters<typeof api.createConsentTemplate>) =>
    api.createConsentTemplate(...args),
  updateConsentTemplate: (...args: Parameters<typeof api.updateConsentTemplate>) =>
    api.updateConsentTemplate(...args),
  deleteConsentTemplate: (...args: Parameters<typeof api.deleteConsentTemplate>) =>
    api.deleteConsentTemplate(...args),
  listConsentAudit: (...args: Parameters<typeof api.listConsentAudit>) =>
    api.listConsentAudit(...args),
  getPatientConsentSummary: (...args: Parameters<typeof api.getPatientConsentSummary>) =>
    api.getPatientConsentSummary(...args),
  revokeConsent: (...args: Parameters<typeof api.revokeConsent>) => api.revokeConsent(...args),
  listConsentSignatures: (...args: Parameters<typeof api.listConsentSignatures>) =>
    api.listConsentSignatures(...args),
  createConsentSignature: (...args: Parameters<typeof api.createConsentSignature>) =>
    api.createConsentSignature(...args),
  deleteConsentSignature: (...args: Parameters<typeof api.deleteConsentSignature>) =>
    api.deleteConsentSignature(...args),
};
