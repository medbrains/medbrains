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
};
