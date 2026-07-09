import { api } from "@medbrains/api";

export const infectionControlService = {
  listSurveillanceEvents: (...args: Parameters<typeof api.listSurveillanceEvents>) =>
    api.listSurveillanceEvents(...args),
  createSurveillanceEvent: (...args: Parameters<typeof api.createSurveillanceEvent>) =>
    api.createSurveillanceEvent(...args),
  listStewardshipRequests: (...args: Parameters<typeof api.listStewardshipRequests>) =>
    api.listStewardshipRequests(...args),
  listCultureSurveillance: (...args: Parameters<typeof api.listCultureSurveillance>) =>
    api.listCultureSurveillance(...args),
  createStewardshipRequest: (...args: Parameters<typeof api.createStewardshipRequest>) =>
    api.createStewardshipRequest(...args),
  reviewStewardshipRequest: (...args: Parameters<typeof api.reviewStewardshipRequest>) =>
    api.reviewStewardshipRequest(...args),
  timeoutReviewStewardship: (...args: Parameters<typeof api.timeoutReviewStewardship>) =>
    api.timeoutReviewStewardship(...args),
  listBiowasteRecords: (...args: Parameters<typeof api.listBiowasteRecords>) =>
    api.listBiowasteRecords(...args),
  createBiowasteRecord: (...args: Parameters<typeof api.createBiowasteRecord>) =>
    api.createBiowasteRecord(...args),
  listHygieneAudits: (...args: Parameters<typeof api.listHygieneAudits>) =>
    api.listHygieneAudits(...args),
  listDeviceDays: (...args: Parameters<typeof api.listDeviceDays>) => api.listDeviceDays(...args),
  createHygieneAudit: (...args: Parameters<typeof api.createHygieneAudit>) =>
    api.createHygieneAudit(...args),
  listOutbreaks: (...args: Parameters<typeof api.listOutbreaks>) => api.listOutbreaks(...args),
  listOutbreakContacts: (...args: Parameters<typeof api.listOutbreakContacts>) =>
    api.listOutbreakContacts(...args),
  createOutbreak: (...args: Parameters<typeof api.createOutbreak>) => api.createOutbreak(...args),
  updateOutbreak: (...args: Parameters<typeof api.updateOutbreak>) => api.updateOutbreak(...args),
  listNeedleStickIncidents: (...args: Parameters<typeof api.listNeedleStickIncidents>) =>
    api.listNeedleStickIncidents(...args),
  icHaiRates: (...args: Parameters<typeof api.icHaiRates>) => api.icHaiRates(...args),
  icDeviceUtilization: (...args: Parameters<typeof api.icDeviceUtilization>) =>
    api.icDeviceUtilization(...args),
  icAntimicrobialConsumption: (...args: Parameters<typeof api.icAntimicrobialConsumption>) =>
    api.icAntimicrobialConsumption(...args),
  icSurgicalProphylaxis: (...args: Parameters<typeof api.icSurgicalProphylaxis>) =>
    api.icSurgicalProphylaxis(...args),
  icCultureSensitivityReport: (...args: Parameters<typeof api.icCultureSensitivityReport>) =>
    api.icCultureSensitivityReport(...args),
  icMdroTracking: (...args: Parameters<typeof api.icMdroTracking>) => api.icMdroTracking(...args),
  listIcMeetings: (...args: Parameters<typeof api.listIcMeetings>) => api.listIcMeetings(...args),
  icMonthlySurveillance: (...args: Parameters<typeof api.icMonthlySurveillance>) =>
    api.icMonthlySurveillance(...args),
  createIcMeeting: (...args: Parameters<typeof api.createIcMeeting>) =>
    api.createIcMeeting(...args),
  createIcExposure: (...args: Parameters<typeof api.createIcExposure>) =>
    api.createIcExposure(...args),
};
