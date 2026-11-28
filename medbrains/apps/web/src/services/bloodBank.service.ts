import { bloodBankApi } from "@medbrains/api/modules/blood-bank";

export const bloodBankService = {
  listBloodDonors: (...args: Parameters<typeof bloodBankApi.listBloodDonors>) =>
    bloodBankApi.listBloodDonors(...args),
  createBloodDonor: (...args: Parameters<typeof bloodBankApi.createBloodDonor>) =>
    bloodBankApi.createBloodDonor(...args),
  listDonations: (...args: Parameters<typeof bloodBankApi.listDonations>) =>
    bloodBankApi.listDonations(...args),
  createDonation: (...args: Parameters<typeof bloodBankApi.createDonation>) =>
    bloodBankApi.createDonation(...args),
  updateDonation: (...args: Parameters<typeof bloodBankApi.updateDonation>) =>
    bloodBankApi.updateDonation(...args),
  setDonorDeferral: (...args: Parameters<typeof bloodBankApi.setDonorDeferral>) =>
    bloodBankApi.setDonorDeferral(...args),
  listTtiResults: (...args: Parameters<typeof bloodBankApi.listTtiResults>) =>
    bloodBankApi.listTtiResults(...args),
  recordTtiResults: (...args: Parameters<typeof bloodBankApi.recordTtiResults>) =>
    bloodBankApi.recordTtiResults(...args),
  listBloodComponents: (...args: Parameters<typeof bloodBankApi.listBloodComponents>) =>
    bloodBankApi.listBloodComponents(...args),
  createBloodComponent: (...args: Parameters<typeof bloodBankApi.createBloodComponent>) =>
    bloodBankApi.createBloodComponent(...args),
  updateComponentStatus: (...args: Parameters<typeof bloodBankApi.updateComponentStatus>) =>
    bloodBankApi.updateComponentStatus(...args),
  listCrossmatchRequests: (...args: Parameters<typeof bloodBankApi.listCrossmatchRequests>) =>
    bloodBankApi.listCrossmatchRequests(...args),
  createCrossmatchRequest: (...args: Parameters<typeof bloodBankApi.createCrossmatchRequest>) =>
    bloodBankApi.createCrossmatchRequest(...args),
  updateCrossmatchRequest: (...args: Parameters<typeof bloodBankApi.updateCrossmatchRequest>) =>
    bloodBankApi.updateCrossmatchRequest(...args),
  listTransfusions: (...args: Parameters<typeof bloodBankApi.listTransfusions>) =>
    bloodBankApi.listTransfusions(...args),
  createTransfusion: (...args: Parameters<typeof bloodBankApi.createTransfusion>) =>
    bloodBankApi.createTransfusion(...args),
  recordTransfusionReaction: (...args: Parameters<typeof bloodBankApi.recordTransfusionReaction>) =>
    bloodBankApi.recordTransfusionReaction(...args),
  listTransfusionObservations: (
    ...args: Parameters<typeof bloodBankApi.listTransfusionObservations>
  ) => bloodBankApi.listTransfusionObservations(...args),
  recordTransfusionObservation: (
    ...args: Parameters<typeof bloodBankApi.recordTransfusionObservation>
  ) => bloodBankApi.recordTransfusionObservation(...args),
  getTtiReport: (...args: Parameters<typeof bloodBankApi.getTtiReport>) =>
    bloodBankApi.getTtiReport(...args),
  getHemovigilanceReport: (...args: Parameters<typeof bloodBankApi.getHemovigilanceReport>) =>
    bloodBankApi.getHemovigilanceReport(...args),
  getBbSbtcReport: (...args: Parameters<typeof bloodBankApi.getBbSbtcReport>) =>
    bloodBankApi.getBbSbtcReport(...args),
  listBbMsbos: (...args: Parameters<typeof bloodBankApi.listBbMsbos>) =>
    bloodBankApi.listBbMsbos(...args),
  createBbMsbos: (...args: Parameters<typeof bloodBankApi.createBbMsbos>) =>
    bloodBankApi.createBbMsbos(...args),
  createBbReturn: (...args: Parameters<typeof bloodBankApi.createBbReturn>) =>
    bloodBankApi.createBbReturn(...args),
  listBbDevices: (...args: Parameters<typeof bloodBankApi.listBbDevices>) =>
    bloodBankApi.listBbDevices(...args),
  createBbDevice: (...args: Parameters<typeof bloodBankApi.createBbDevice>) =>
    bloodBankApi.createBbDevice(...args),
  listBbReadings: (...args: Parameters<typeof bloodBankApi.listBbReadings>) =>
    bloodBankApi.listBbReadings(...args),
  addBbReading: (...args: Parameters<typeof bloodBankApi.addBbReading>) =>
    bloodBankApi.addBbReading(...args),
  listBbLookback: (...args: Parameters<typeof bloodBankApi.listBbLookback>) =>
    bloodBankApi.listBbLookback(...args),
  createBbLookback: (...args: Parameters<typeof bloodBankApi.createBbLookback>) =>
    bloodBankApi.createBbLookback(...args),
  updateBbLookback: (...args: Parameters<typeof bloodBankApi.updateBbLookback>) =>
    bloodBankApi.updateBbLookback(...args),
  listBbCampaigns: (...args: Parameters<typeof bloodBankApi.listBbCampaigns>) =>
    bloodBankApi.listBbCampaigns(...args),
  createBbCampaign: (...args: Parameters<typeof bloodBankApi.createBbCampaign>) =>
    bloodBankApi.createBbCampaign(...args),
  updateBbCampaign: (...args: Parameters<typeof bloodBankApi.updateBbCampaign>) =>
    bloodBankApi.updateBbCampaign(...args),
};
