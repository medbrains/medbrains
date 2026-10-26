import { api } from "@medbrains/api";

/** DPDP / CERT-In compliance pack. */
export const privacyComplianceService = {
  dashboard: () => api.getDpdpDashboard(),
  listOfficers: () => api.listPrivacyOfficers(),
  setOfficer: (...args: Parameters<typeof api.setPrivacyOfficer>) => api.setPrivacyOfficer(...args),
  publishOfficer: (...args: Parameters<typeof api.publishPrivacyOfficer>) =>
    api.publishPrivacyOfficer(...args),
  publicNotice: () => api.getDpdpPublicNotice(),
  listTemplates: () => api.listCompliancePolicyTemplates(),
  listPolicies: (...args: Parameters<typeof api.listCompliancePolicies>) =>
    api.listCompliancePolicies(...args),
  startDraft: (...args: Parameters<typeof api.startCompliancePolicyDraft>) =>
    api.startCompliancePolicyDraft(...args),
  editPolicy: (...args: Parameters<typeof api.editCompliancePolicy>) =>
    api.editCompliancePolicy(...args),
  submitPolicy: (id: string) => api.submitCompliancePolicy(id),
  approvePolicy: (id: string) => api.approveCompliancePolicy(id),
  returnPolicy: (...args: Parameters<typeof api.returnCompliancePolicy>) =>
    api.returnCompliancePolicy(...args),
  listDrills: () => api.listComplianceDrills(),
  recordDrill: (...args: Parameters<typeof api.recordComplianceDrill>) =>
    api.recordComplianceDrill(...args),
};
