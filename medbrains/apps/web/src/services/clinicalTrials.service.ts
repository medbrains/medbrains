import { api } from "@medbrains/api";

export const clinicalTrialsService = {
  listClinicalTrials: api.listClinicalTrials,
  getClinicalTrial: api.getClinicalTrial,
  createClinicalTrial: api.createClinicalTrial,
  updateClinicalTrial: api.updateClinicalTrial,
  screenTrialCandidates: api.screenTrialCandidates,
  listTrialConsents: api.listTrialConsents,
  recordTrialConsent: api.recordTrialConsent,
  listConsentTemplates: api.listConsentTemplates,
  listTrialVisits: api.listTrialVisits,
  scheduleTrialVisit: api.scheduleTrialVisit,
  updateTrialVisit: api.updateTrialVisit,
};
