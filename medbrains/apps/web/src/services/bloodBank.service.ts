import { api } from "@medbrains/api";

export const bloodBankService = {
  listBloodDonors: (...args: Parameters<typeof api.listBloodDonors>) =>
    api.listBloodDonors(...args),
  createBloodDonor: (...args: Parameters<typeof api.createBloodDonor>) =>
    api.createBloodDonor(...args),
  listDonations: (...args: Parameters<typeof api.listDonations>) => api.listDonations(...args),
  createDonation: (...args: Parameters<typeof api.createDonation>) => api.createDonation(...args),
  updateDonation: (...args: Parameters<typeof api.updateDonation>) => api.updateDonation(...args),
  listBloodComponents: (...args: Parameters<typeof api.listBloodComponents>) =>
    api.listBloodComponents(...args),
  createBloodComponent: (...args: Parameters<typeof api.createBloodComponent>) =>
    api.createBloodComponent(...args),
  updateComponentStatus: (...args: Parameters<typeof api.updateComponentStatus>) =>
    api.updateComponentStatus(...args),
  listCrossmatchRequests: (...args: Parameters<typeof api.listCrossmatchRequests>) =>
    api.listCrossmatchRequests(...args),
  createCrossmatchRequest: (...args: Parameters<typeof api.createCrossmatchRequest>) =>
    api.createCrossmatchRequest(...args),
  updateCrossmatchRequest: (...args: Parameters<typeof api.updateCrossmatchRequest>) =>
    api.updateCrossmatchRequest(...args),
  listTransfusions: (...args: Parameters<typeof api.listTransfusions>) =>
    api.listTransfusions(...args),
  createTransfusion: (...args: Parameters<typeof api.createTransfusion>) =>
    api.createTransfusion(...args),
  recordTransfusionReaction: (...args: Parameters<typeof api.recordTransfusionReaction>) =>
    api.recordTransfusionReaction(...args),
  getTtiReport: (...args: Parameters<typeof api.getTtiReport>) => api.getTtiReport(...args),
  getHemovigilanceReport: (...args: Parameters<typeof api.getHemovigilanceReport>) =>
    api.getHemovigilanceReport(...args),
  getBbSbtcReport: (...args: Parameters<typeof api.getBbSbtcReport>) =>
    api.getBbSbtcReport(...args),
  listBbMsbos: (...args: Parameters<typeof api.listBbMsbos>) => api.listBbMsbos(...args),
  createBbMsbos: (...args: Parameters<typeof api.createBbMsbos>) => api.createBbMsbos(...args),
  createBbReturn: (...args: Parameters<typeof api.createBbReturn>) => api.createBbReturn(...args),
  listBbDevices: (...args: Parameters<typeof api.listBbDevices>) => api.listBbDevices(...args),
  createBbDevice: (...args: Parameters<typeof api.createBbDevice>) => api.createBbDevice(...args),
  listBbReadings: (...args: Parameters<typeof api.listBbReadings>) => api.listBbReadings(...args),
  addBbReading: (...args: Parameters<typeof api.addBbReading>) => api.addBbReading(...args),
  listBbLookback: (...args: Parameters<typeof api.listBbLookback>) => api.listBbLookback(...args),
  createBbLookback: (...args: Parameters<typeof api.createBbLookback>) =>
    api.createBbLookback(...args),
  updateBbLookback: (...args: Parameters<typeof api.updateBbLookback>) =>
    api.updateBbLookback(...args),
  listBbCampaigns: (...args: Parameters<typeof api.listBbCampaigns>) =>
    api.listBbCampaigns(...args),
  createBbCampaign: (...args: Parameters<typeof api.createBbCampaign>) =>
    api.createBbCampaign(...args),
  updateBbCampaign: (...args: Parameters<typeof api.updateBbCampaign>) =>
    api.updateBbCampaign(...args),
};
