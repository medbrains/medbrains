/** The pharmacy's side of the storefront: verification, listing, settings, the H1 register. */

import { api } from "@medbrains/api";

export const storefrontService = {
  listStorefrontOrders: (status?: string) => api.listStorefrontOrders(status),
  storefrontPrescriptionUrl: (id: string) => api.storefrontPrescriptionUrl(id),
  verifyStorefrontOrder: (...args: Parameters<typeof api.verifyStorefrontOrder>) =>
    api.verifyStorefrontOrder(...args),
  setStorefrontListing: (...args: Parameters<typeof api.setStorefrontListing>) =>
    api.setStorefrontListing(...args),
  listStorefrontPharmacists: () => api.listStorefrontPharmacists(),
  getStorefrontSettings: () => api.getStorefrontSettings(),
  updateStorefrontSettings: (...args: Parameters<typeof api.updateStorefrontSettings>) =>
    api.updateStorefrontSettings(...args),
  getH1Register: (from: string, to: string) => api.getH1Register(from, to),
  // Part 2 (#4864): rules, stores, floors, substitutes, returns, refunds.
  getStorefrontRules: () => api.getStorefrontRules(),
  updateStorefrontRules: (...args: Parameters<typeof api.updateStorefrontRules>) =>
    api.updateStorefrontRules(...args),
  listOnlineStores: () => api.listOnlineStores(),
  updateOnlineStore: (...args: Parameters<typeof api.updateOnlineStore>) =>
    api.updateOnlineStore(...args),
  listStorefrontFloors: () => api.listStorefrontFloors(),
  listStorefrontSubstitutes: (orderId: string, itemId: string) =>
    api.listStorefrontSubstitutes(orderId, itemId),
  proposeStorefrontSubstitution: (...args: Parameters<typeof api.proposeStorefrontSubstitution>) =>
    api.proposeStorefrontSubstitution(...args),
  printStorefrontOutside: (orderId: string, itemIds: string[]) =>
    api.printStorefrontOutside(orderId, itemIds),
  getStoreSubstitutionRequest: (id: string) => api.getStoreSubstitutionRequest(id),
  decideStoreSubstitution: (...args: Parameters<typeof api.decideStoreSubstitution>) =>
    api.decideStoreSubstitution(...args),
  listStorefrontReturns: () => api.listStorefrontReturns(),
  acknowledgeStorefrontReturn: (id: string) => api.acknowledgeStorefrontReturn(id),
  receiveStorefrontReturn: (...args: Parameters<typeof api.receiveStorefrontReturn>) =>
    api.receiveStorefrontReturn(...args),
  refuseStorefrontReturn: (id: string, note: string) => api.refuseStorefrontReturn(id, note),
  listStorefrontRefunds: () => api.listStorefrontRefunds(),
  issueStorefrontRefund: (id: string) => api.issueStorefrontRefund(id),
  listQuarantine: () => api.listQuarantine(),
  destroyQuarantine: (...args: Parameters<typeof api.destroyQuarantine>) =>
    api.destroyQuarantine(...args),
  listNppaCeilings: (q?: string) => api.listNppaCeilings(q),
  setNppaCeiling: (...args: Parameters<typeof api.setNppaCeiling>) => api.setNppaCeiling(...args),
  importNppaCeilings: (...args: Parameters<typeof api.importNppaCeilings>) =>
    api.importNppaCeilings(...args),
  getPosReturnPolicy: () => api.getPosReturnPolicy(),
};
