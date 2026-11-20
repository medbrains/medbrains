import { regulatoryApi } from "@medbrains/api/modules/regulatory";

/** DPDP / CERT-In compliance pack. */
export const privacyComplianceService = {
  dashboard: () => regulatoryApi.getDpdpDashboard(),
  listOfficers: () => regulatoryApi.listPrivacyOfficers(),
  setOfficer: (...args: Parameters<typeof regulatoryApi.setPrivacyOfficer>) =>
    regulatoryApi.setPrivacyOfficer(...args),
  publishOfficer: (...args: Parameters<typeof regulatoryApi.publishPrivacyOfficer>) =>
    regulatoryApi.publishPrivacyOfficer(...args),
  publicNotice: () => regulatoryApi.getDpdpPublicNotice(),
  listTemplates: () => regulatoryApi.listCompliancePolicyTemplates(),
  listPolicies: (...args: Parameters<typeof regulatoryApi.listCompliancePolicies>) =>
    regulatoryApi.listCompliancePolicies(...args),
  startDraft: (...args: Parameters<typeof regulatoryApi.startCompliancePolicyDraft>) =>
    regulatoryApi.startCompliancePolicyDraft(...args),
  editPolicy: (...args: Parameters<typeof regulatoryApi.editCompliancePolicy>) =>
    regulatoryApi.editCompliancePolicy(...args),
  submitPolicy: (id: string) => regulatoryApi.submitCompliancePolicy(id),
  approvePolicy: (id: string) => regulatoryApi.approveCompliancePolicy(id),
  returnPolicy: (...args: Parameters<typeof regulatoryApi.returnCompliancePolicy>) =>
    regulatoryApi.returnCompliancePolicy(...args),
  listDrills: () => regulatoryApi.listComplianceDrills(),
  recordDrill: (...args: Parameters<typeof regulatoryApi.recordComplianceDrill>) =>
    regulatoryApi.recordComplianceDrill(...args),
};
