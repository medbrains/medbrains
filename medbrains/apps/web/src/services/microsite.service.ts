import { micrositeApi } from "@medbrains/api/modules/microsite";

export const micrositeService = {
  listHealthPackages: micrositeApi.listHealthPackages,
  createHealthPackage: micrositeApi.createHealthPackage,
  updateHealthPackage: micrositeApi.updateHealthPackage,
  deleteHealthPackage: micrositeApi.deleteHealthPackage,
  bookHealthPackage: micrositeApi.bookHealthPackage,
  listTestimonials: micrositeApi.listTestimonials,
  createTestimonial: micrositeApi.createTestimonial,
  moderateTestimonial: micrositeApi.moderateTestimonial,
  listSeoSettings: micrositeApi.listSeoSettings,
  upsertSeoSetting: micrositeApi.upsertSeoSetting,
  listSiteDomains: micrositeApi.listSiteDomains,
  addSiteDomain: micrositeApi.addSiteDomain,
  verifySiteDomain: micrositeApi.verifySiteDomain,
  getMicrositeConfig: micrositeApi.getMicrositeConfig,
  updateMicrositeConfig: micrositeApi.updateMicrositeConfig,
};
