import { infectionControlApi } from "@medbrains/api/modules/infection-control";

export const infectionControlService = {
  listSurveillanceEvents: (
    ...args: Parameters<typeof infectionControlApi.listSurveillanceEvents>
  ) => infectionControlApi.listSurveillanceEvents(...args),
  createSurveillanceEvent: (
    ...args: Parameters<typeof infectionControlApi.createSurveillanceEvent>
  ) => infectionControlApi.createSurveillanceEvent(...args),
  listStewardshipRequests: (
    ...args: Parameters<typeof infectionControlApi.listStewardshipRequests>
  ) => infectionControlApi.listStewardshipRequests(...args),
  listCultureSurveillance: (
    ...args: Parameters<typeof infectionControlApi.listCultureSurveillance>
  ) => infectionControlApi.listCultureSurveillance(...args),
  createStewardshipRequest: (
    ...args: Parameters<typeof infectionControlApi.createStewardshipRequest>
  ) => infectionControlApi.createStewardshipRequest(...args),
  reviewStewardshipRequest: (
    ...args: Parameters<typeof infectionControlApi.reviewStewardshipRequest>
  ) => infectionControlApi.reviewStewardshipRequest(...args),
  timeoutReviewStewardship: (
    ...args: Parameters<typeof infectionControlApi.timeoutReviewStewardship>
  ) => infectionControlApi.timeoutReviewStewardship(...args),
  listBiowasteRecords: (...args: Parameters<typeof infectionControlApi.listBiowasteRecords>) =>
    infectionControlApi.listBiowasteRecords(...args),
  createBiowasteRecord: (...args: Parameters<typeof infectionControlApi.createBiowasteRecord>) =>
    infectionControlApi.createBiowasteRecord(...args),
  listHygieneAudits: (...args: Parameters<typeof infectionControlApi.listHygieneAudits>) =>
    infectionControlApi.listHygieneAudits(...args),
  listDeviceDays: (...args: Parameters<typeof infectionControlApi.listDeviceDays>) =>
    infectionControlApi.listDeviceDays(...args),
  listIndwellingDevices: (...args: Parameters<typeof infectionControlApi.listIndwellingDevices>) =>
    infectionControlApi.listIndwellingDevices(...args),
  createIndwellingDevice: (
    ...args: Parameters<typeof infectionControlApi.createIndwellingDevice>
  ) => infectionControlApi.createIndwellingDevice(...args),
  reviewIndwellingDevice: (
    ...args: Parameters<typeof infectionControlApi.reviewIndwellingDevice>
  ) => infectionControlApi.reviewIndwellingDevice(...args),
  removeIndwellingDevice: (
    ...args: Parameters<typeof infectionControlApi.removeIndwellingDevice>
  ) => infectionControlApi.removeIndwellingDevice(...args),
  createHygieneAudit: (...args: Parameters<typeof infectionControlApi.createHygieneAudit>) =>
    infectionControlApi.createHygieneAudit(...args),
  listOutbreaks: (...args: Parameters<typeof infectionControlApi.listOutbreaks>) =>
    infectionControlApi.listOutbreaks(...args),
  listOutbreakContacts: (...args: Parameters<typeof infectionControlApi.listOutbreakContacts>) =>
    infectionControlApi.listOutbreakContacts(...args),
  createOutbreak: (...args: Parameters<typeof infectionControlApi.createOutbreak>) =>
    infectionControlApi.createOutbreak(...args),
  updateOutbreak: (...args: Parameters<typeof infectionControlApi.updateOutbreak>) =>
    infectionControlApi.updateOutbreak(...args),
  listNeedleStickIncidents: (
    ...args: Parameters<typeof infectionControlApi.listNeedleStickIncidents>
  ) => infectionControlApi.listNeedleStickIncidents(...args),
  icHaiRates: (...args: Parameters<typeof infectionControlApi.icHaiRates>) =>
    infectionControlApi.icHaiRates(...args),
  icDeviceUtilization: (...args: Parameters<typeof infectionControlApi.icDeviceUtilization>) =>
    infectionControlApi.icDeviceUtilization(...args),
  icAntimicrobialConsumption: (
    ...args: Parameters<typeof infectionControlApi.icAntimicrobialConsumption>
  ) => infectionControlApi.icAntimicrobialConsumption(...args),
  icSurgicalProphylaxis: (...args: Parameters<typeof infectionControlApi.icSurgicalProphylaxis>) =>
    infectionControlApi.icSurgicalProphylaxis(...args),
  icCultureSensitivityReport: (
    ...args: Parameters<typeof infectionControlApi.icCultureSensitivityReport>
  ) => infectionControlApi.icCultureSensitivityReport(...args),
  icMdroTracking: (...args: Parameters<typeof infectionControlApi.icMdroTracking>) =>
    infectionControlApi.icMdroTracking(...args),
  listIcMeetings: (...args: Parameters<typeof infectionControlApi.listIcMeetings>) =>
    infectionControlApi.listIcMeetings(...args),
  icMonthlySurveillance: (...args: Parameters<typeof infectionControlApi.icMonthlySurveillance>) =>
    infectionControlApi.icMonthlySurveillance(...args),
  createIcMeeting: (...args: Parameters<typeof infectionControlApi.createIcMeeting>) =>
    infectionControlApi.createIcMeeting(...args),
  createIcExposure: (...args: Parameters<typeof infectionControlApi.createIcExposure>) =>
    infectionControlApi.createIcExposure(...args),
};
