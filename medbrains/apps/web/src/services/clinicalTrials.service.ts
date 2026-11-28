import { clinicalTrialsApi } from "@medbrains/api/modules/clinical-trials";
import { consentApi } from "@medbrains/api/modules/consent";
import { trialAdverseEventsApi } from "@medbrains/api/modules/trial-adverse-events";
import { trialIrbApi } from "@medbrains/api/modules/trial-irb";
import { trialRandomizationsApi } from "@medbrains/api/modules/trial-randomizations";
import { trialVisitsApi } from "@medbrains/api/modules/trial-visits";

export const clinicalTrialsService = {
  listClinicalTrials: clinicalTrialsApi.listClinicalTrials,
  getClinicalTrial: clinicalTrialsApi.getClinicalTrial,
  createClinicalTrial: clinicalTrialsApi.createClinicalTrial,
  updateClinicalTrial: clinicalTrialsApi.updateClinicalTrial,
  screenTrialCandidates: clinicalTrialsApi.screenTrialCandidates,
  listTrialConsents: clinicalTrialsApi.listTrialConsents,
  recordTrialConsent: clinicalTrialsApi.recordTrialConsent,
  listConsentTemplates: consentApi.listConsentTemplates,
  listTrialVisits: clinicalTrialsApi.listTrialVisits,
  scheduleTrialVisit: clinicalTrialsApi.scheduleTrialVisit,
  updateTrialVisit: trialVisitsApi.updateTrialVisit,
  listAdverseEvents: clinicalTrialsApi.listAdverseEvents,
  reportAdverseEvent: clinicalTrialsApi.reportAdverseEvent,
  updateAdverseEvent: trialAdverseEventsApi.updateAdverseEvent,
  listRandomizations: clinicalTrialsApi.listRandomizations,
  randomizePatient: clinicalTrialsApi.randomizePatient,
  unblindRandomization: trialRandomizationsApi.unblindRandomization,
  listIrbSubmissions: clinicalTrialsApi.listIrbSubmissions,
  createIrbSubmission: clinicalTrialsApi.createIrbSubmission,
  updateIrbSubmission: trialIrbApi.updateIrbSubmission,
  exportTrial: clinicalTrialsApi.exportTrial,
};
