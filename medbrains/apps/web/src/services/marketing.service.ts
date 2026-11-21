import { marketingApi } from "@medbrains/api/modules/marketing";
import { publicApi } from "@medbrains/api/modules/public";

/**
 * Thin passthrough, matching every other service in this app: the pages call
 * this rather than the API client directly so the surface stays swappable in tests.
 */
export const marketingService = {
  listCampaigns: (...args: Parameters<typeof marketingApi.listMarketingCampaigns>) =>
    marketingApi.listMarketingCampaigns(...args),
  createCampaign: (...args: Parameters<typeof marketingApi.createMarketingCampaign>) =>
    marketingApi.createMarketingCampaign(...args),
  updateCampaign: (...args: Parameters<typeof marketingApi.updateMarketingCampaign>) =>
    marketingApi.updateMarketingCampaign(...args),
  campaignFunnel: (...args: Parameters<typeof marketingApi.marketingCampaignFunnel>) =>
    marketingApi.marketingCampaignFunnel(...args),
  funnel: (...args: Parameters<typeof marketingApi.marketingFunnel>) =>
    marketingApi.marketingFunnel(...args),
  attribution: (...args: Parameters<typeof marketingApi.marketingAttribution>) =>
    marketingApi.marketingAttribution(...args),
  channelJourney: (...args: Parameters<typeof marketingApi.marketingChannelJourney>) =>
    marketingApi.marketingChannelJourney(...args),
  areaPerformance: (...args: Parameters<typeof marketingApi.marketingAreaPerformance>) =>
    marketingApi.marketingAreaPerformance(...args),
  campAcquisition: (...args: Parameters<typeof marketingApi.marketingCampAcquisition>) =>
    marketingApi.marketingCampAcquisition(...args),
  startOutreachRun: (...args: Parameters<typeof marketingApi.startMarketingOutreachRun>) =>
    marketingApi.startMarketingOutreachRun(...args),
  sendPolicy: (...args: Parameters<typeof marketingApi.marketingSendPolicy>) =>
    marketingApi.marketingSendPolicy(...args),
  updateSendPolicy: (...args: Parameters<typeof marketingApi.updateMarketingSendPolicy>) =>
    marketingApi.updateMarketingSendPolicy(...args),
  webForm: (...args: Parameters<typeof marketingApi.marketingWebForm>) =>
    marketingApi.marketingWebForm(...args),
  updateWebForm: (...args: Parameters<typeof marketingApi.updateMarketingWebForm>) =>
    marketingApi.updateMarketingWebForm(...args),
  listRunMessages: (...args: Parameters<typeof marketingApi.listMarketingRunMessages>) =>
    marketingApi.listMarketingRunMessages(...args),
  linkCampAttendees: (...args: Parameters<typeof marketingApi.linkCampAttendees>) =>
    marketingApi.linkCampAttendees(...args),
  listAreas: (...args: Parameters<typeof marketingApi.listMarketingAreas>) =>
    marketingApi.listMarketingAreas(...args),
  upsertArea: (...args: Parameters<typeof marketingApi.upsertMarketingArea>) =>
    marketingApi.upsertMarketingArea(...args),
  listDistributions: (...args: Parameters<typeof marketingApi.listMarketingDistributions>) =>
    marketingApi.listMarketingDistributions(...args),
  createDistribution: (...args: Parameters<typeof marketingApi.createMarketingDistribution>) =>
    marketingApi.createMarketingDistribution(...args),
  listTouchpoints: (...args: Parameters<typeof marketingApi.listMarketingTouchpoints>) =>
    marketingApi.listMarketingTouchpoints(...args),
  addTouchpoint: (...args: Parameters<typeof marketingApi.addMarketingTouchpoint>) =>
    marketingApi.addMarketingTouchpoint(...args),
  listContacts: (...args: Parameters<typeof marketingApi.listMarketingContacts>) =>
    marketingApi.listMarketingContacts(...args),
  getContact: (...args: Parameters<typeof marketingApi.getMarketingContact>) =>
    marketingApi.getMarketingContact(...args),
  createContact: (...args: Parameters<typeof marketingApi.createMarketingContact>) =>
    marketingApi.createMarketingContact(...args),
  listInteractions: (...args: Parameters<typeof marketingApi.listMarketingInteractions>) =>
    marketingApi.listMarketingInteractions(...args),
  logInteraction: (...args: Parameters<typeof marketingApi.logMarketingInteraction>) =>
    marketingApi.logMarketingInteraction(...args),
  moveStage: (...args: Parameters<typeof marketingApi.moveMarketingStage>) =>
    marketingApi.moveMarketingStage(...args),
  listStages: (...args: Parameters<typeof marketingApi.listMarketingStages>) =>
    marketingApi.listMarketingStages(...args),
  listCallbacks: (...args: Parameters<typeof marketingApi.listMarketingCallbacks>) =>
    marketingApi.listMarketingCallbacks(...args),
  callbackSummary: (...args: Parameters<typeof marketingApi.marketingCallbackSummary>) =>
    marketingApi.marketingCallbackSummary(...args),
  listConsent: (...args: Parameters<typeof marketingApi.listMarketingConsent>) =>
    marketingApi.listMarketingConsent(...args),
  recordConsent: (...args: Parameters<typeof marketingApi.recordMarketingConsent>) =>
    marketingApi.recordMarketingConsent(...args),
  withdrawConsent: (...args: Parameters<typeof marketingApi.withdrawMarketingConsent>) =>
    marketingApi.withdrawMarketingConsent(...args),
  listSuppressions: (...args: Parameters<typeof marketingApi.listMarketingSuppressions>) =>
    marketingApi.listMarketingSuppressions(...args),
  addSuppression: (...args: Parameters<typeof marketingApi.addMarketingSuppression>) =>
    marketingApi.addMarketingSuppression(...args),
  submitPublicEnquiry: (...args: Parameters<typeof publicApi.submitPublicEnquiry>) =>
    publicApi.submitPublicEnquiry(...args),
  patientMatches: (...args: Parameters<typeof marketingApi.marketingPatientMatches>) =>
    marketingApi.marketingPatientMatches(...args),
  convertContact: (...args: Parameters<typeof marketingApi.convertMarketingContact>) =>
    marketingApi.convertMarketingContact(...args),
  completeCallback: (...args: Parameters<typeof marketingApi.completeMarketingCallback>) =>
    marketingApi.completeMarketingCallback(...args),
  rescheduleCallback: (...args: Parameters<typeof marketingApi.rescheduleMarketingCallback>) =>
    marketingApi.rescheduleMarketingCallback(...args),
  listOutreachRuns: (...args: Parameters<typeof marketingApi.listMarketingOutreachRuns>) =>
    marketingApi.listMarketingOutreachRuns(...args),
  submitOutreachRun: (...args: Parameters<typeof marketingApi.submitMarketingOutreachRun>) =>
    marketingApi.submitMarketingOutreachRun(...args),
  approveOutreachRun: (...args: Parameters<typeof marketingApi.approveMarketingOutreachRun>) =>
    marketingApi.approveMarketingOutreachRun(...args),
  cancelOutreachRun: (...args: Parameters<typeof marketingApi.cancelMarketingOutreachRun>) =>
    marketingApi.cancelMarketingOutreachRun(...args),
  listCohorts: (...args: Parameters<typeof marketingApi.listMarketingCohorts>) =>
    marketingApi.listMarketingCohorts(...args),
  refreshCohort: (...args: Parameters<typeof marketingApi.refreshMarketingCohort>) =>
    marketingApi.refreshMarketingCohort(...args),
  createEnquiryCohort: (...args: Parameters<typeof marketingApi.createMarketingEnquiryCohort>) =>
    marketingApi.createMarketingEnquiryCohort(...args),
  createClinicalCohort: (...args: Parameters<typeof marketingApi.createMarketingClinicalCohort>) =>
    marketingApi.createMarketingClinicalCohort(...args),
  cohortSize: (...args: Parameters<typeof marketingApi.marketingCohortSize>) =>
    marketingApi.marketingCohortSize(...args),
  screenPop: (...args: Parameters<typeof marketingApi.marketingScreenPop>) =>
    marketingApi.marketingScreenPop(...args),
  missedCalls: (...args: Parameters<typeof marketingApi.marketingMissedCalls>) =>
    marketingApi.marketingMissedCalls(...args),
};
