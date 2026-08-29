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
};
