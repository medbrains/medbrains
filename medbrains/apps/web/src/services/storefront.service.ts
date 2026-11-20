/** The pharmacy's side of the storefront: verification, listing, settings, the H1 register. */

import { doctorApi } from "@medbrains/api/modules/doctor";
import { pharmacyApi } from "@medbrains/api/modules/pharmacy";

export const storefrontService = {
  listStorefrontOrders: (status?: string) => pharmacyApi.listStorefrontOrders(status),
  storefrontPrescriptionUrl: (id: string) => pharmacyApi.storefrontPrescriptionUrl(id),
  verifyStorefrontOrder: (...args: Parameters<typeof pharmacyApi.verifyStorefrontOrder>) =>
    pharmacyApi.verifyStorefrontOrder(...args),
  setStorefrontListing: (...args: Parameters<typeof pharmacyApi.setStorefrontListing>) =>
    pharmacyApi.setStorefrontListing(...args),
  listStorefrontPharmacists: () => pharmacyApi.listStorefrontPharmacists(),
  getStorefrontSettings: () => pharmacyApi.getStorefrontSettings(),
  updateStorefrontSettings: (...args: Parameters<typeof pharmacyApi.updateStorefrontSettings>) =>
    pharmacyApi.updateStorefrontSettings(...args),
  getH1Register: (from: string, to: string) => pharmacyApi.getH1Register(from, to),
  // Part 2 (#4864): rules, stores, floors, substitutes, returns, refunds.
  getStorefrontRules: () => pharmacyApi.getStorefrontRules(),
  updateStorefrontRules: (...args: Parameters<typeof pharmacyApi.updateStorefrontRules>) =>
    pharmacyApi.updateStorefrontRules(...args),
  listOnlineStores: () => pharmacyApi.listOnlineStores(),
  updateOnlineStore: (...args: Parameters<typeof pharmacyApi.updateOnlineStore>) =>
    pharmacyApi.updateOnlineStore(...args),
  listStorefrontFloors: () => pharmacyApi.listStorefrontFloors(),
  listStorefrontSubstitutes: (orderId: string, itemId: string) =>
    pharmacyApi.listStorefrontSubstitutes(orderId, itemId),
  proposeStorefrontSubstitution: (
    ...args: Parameters<typeof pharmacyApi.proposeStorefrontSubstitution>
  ) => pharmacyApi.proposeStorefrontSubstitution(...args),
  printStorefrontOutside: (orderId: string, itemIds: string[]) =>
    pharmacyApi.printStorefrontOutside(orderId, itemIds),
  getStoreSubstitutionRequest: (id: string) => doctorApi.getStoreSubstitutionRequest(id),
  decideStoreSubstitution: (...args: Parameters<typeof doctorApi.decideStoreSubstitution>) =>
    doctorApi.decideStoreSubstitution(...args),
  listStorefrontReturns: () => pharmacyApi.listStorefrontReturns(),
  acknowledgeStorefrontReturn: (id: string) => pharmacyApi.acknowledgeStorefrontReturn(id),
  receiveStorefrontReturn: (...args: Parameters<typeof pharmacyApi.receiveStorefrontReturn>) =>
    pharmacyApi.receiveStorefrontReturn(...args),
  refuseStorefrontReturn: (id: string, note: string) =>
    pharmacyApi.refuseStorefrontReturn(id, note),
  listStorefrontRefunds: () => pharmacyApi.listStorefrontRefunds(),
  issueStorefrontRefund: (id: string) => pharmacyApi.issueStorefrontRefund(id),
  listQuarantine: () => pharmacyApi.listQuarantine(),
  destroyQuarantine: (...args: Parameters<typeof pharmacyApi.destroyQuarantine>) =>
    pharmacyApi.destroyQuarantine(...args),
  listNppaCeilings: (q?: string) => pharmacyApi.listNppaCeilings(q),
  setNppaCeiling: (...args: Parameters<typeof pharmacyApi.setNppaCeiling>) =>
    pharmacyApi.setNppaCeiling(...args),
  importNppaCeilings: (...args: Parameters<typeof pharmacyApi.importNppaCeilings>) =>
    pharmacyApi.importNppaCeilings(...args),
  getPosReturnPolicy: () => pharmacyApi.getPosReturnPolicy(),
};
