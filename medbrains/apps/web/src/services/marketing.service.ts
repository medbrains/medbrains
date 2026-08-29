import { api } from "@medbrains/api";

/**
 * Thin passthrough, matching every other service in this app: the pages call
 * this rather than `api` directly so the surface stays swappable in tests.
 */
export const marketingService = {
  listCampaigns: (...args: Parameters<typeof api.listMarketingCampaigns>) =>
    api.listMarketingCampaigns(...args),
  createCampaign: (...args: Parameters<typeof api.createMarketingCampaign>) =>
    api.createMarketingCampaign(...args),
  updateCampaign: (...args: Parameters<typeof api.updateMarketingCampaign>) =>
    api.updateMarketingCampaign(...args),
  campaignFunnel: (...args: Parameters<typeof api.marketingCampaignFunnel>) =>
    api.marketingCampaignFunnel(...args),
  funnel: (...args: Parameters<typeof api.marketingFunnel>) => api.marketingFunnel(...args),
  attribution: (...args: Parameters<typeof api.marketingAttribution>) =>
    api.marketingAttribution(...args),
  listTouchpoints: (...args: Parameters<typeof api.listMarketingTouchpoints>) =>
    api.listMarketingTouchpoints(...args),
  addTouchpoint: (...args: Parameters<typeof api.addMarketingTouchpoint>) =>
    api.addMarketingTouchpoint(...args),
  listContacts: (...args: Parameters<typeof api.listMarketingContacts>) =>
    api.listMarketingContacts(...args),
  getContact: (...args: Parameters<typeof api.getMarketingContact>) =>
    api.getMarketingContact(...args),
  createContact: (...args: Parameters<typeof api.createMarketingContact>) =>
    api.createMarketingContact(...args),
  listInteractions: (...args: Parameters<typeof api.listMarketingInteractions>) =>
    api.listMarketingInteractions(...args),
  logInteraction: (...args: Parameters<typeof api.logMarketingInteraction>) =>
    api.logMarketingInteraction(...args),
  moveStage: (...args: Parameters<typeof api.moveMarketingStage>) =>
    api.moveMarketingStage(...args),
  listStages: (...args: Parameters<typeof api.listMarketingStages>) =>
    api.listMarketingStages(...args),
  listCallbacks: (...args: Parameters<typeof api.listMarketingCallbacks>) =>
    api.listMarketingCallbacks(...args),
  callbackSummary: (...args: Parameters<typeof api.marketingCallbackSummary>) =>
    api.marketingCallbackSummary(...args),
  completeCallback: (...args: Parameters<typeof api.completeMarketingCallback>) =>
    api.completeMarketingCallback(...args),
  rescheduleCallback: (...args: Parameters<typeof api.rescheduleMarketingCallback>) =>
    api.rescheduleMarketingCallback(...args),
  listOutreachRuns: (...args: Parameters<typeof api.listMarketingOutreachRuns>) =>
    api.listMarketingOutreachRuns(...args),
  submitOutreachRun: (...args: Parameters<typeof api.submitMarketingOutreachRun>) =>
    api.submitMarketingOutreachRun(...args),
  approveOutreachRun: (...args: Parameters<typeof api.approveMarketingOutreachRun>) =>
    api.approveMarketingOutreachRun(...args),
  cancelOutreachRun: (...args: Parameters<typeof api.cancelMarketingOutreachRun>) =>
    api.cancelMarketingOutreachRun(...args),
  listCohorts: (...args: Parameters<typeof api.listMarketingCohorts>) =>
    api.listMarketingCohorts(...args),
  refreshCohort: (...args: Parameters<typeof api.refreshMarketingCohort>) =>
    api.refreshMarketingCohort(...args),
  createEnquiryCohort: (...args: Parameters<typeof api.createMarketingEnquiryCohort>) =>
    api.createMarketingEnquiryCohort(...args),
  createClinicalCohort: (...args: Parameters<typeof api.createMarketingClinicalCohort>) =>
    api.createMarketingClinicalCohort(...args),
  cohortSize: (...args: Parameters<typeof api.marketingCohortSize>) =>
    api.marketingCohortSize(...args),
  screenPop: (...args: Parameters<typeof api.marketingScreenPop>) =>
    api.marketingScreenPop(...args),
  missedCalls: (...args: Parameters<typeof api.marketingMissedCalls>) =>
    api.marketingMissedCalls(...args),
};
