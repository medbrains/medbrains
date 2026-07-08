import { api } from "@medbrains/api";

export const micrositeService = {
  listHealthPackages: api.listHealthPackages,
  createHealthPackage: api.createHealthPackage,
  updateHealthPackage: api.updateHealthPackage,
  deleteHealthPackage: api.deleteHealthPackage,
  bookHealthPackage: api.bookHealthPackage,
  listTestimonials: api.listTestimonials,
  createTestimonial: api.createTestimonial,
  moderateTestimonial: api.moderateTestimonial,
  listSeoSettings: api.listSeoSettings,
  upsertSeoSetting: api.upsertSeoSetting,
  listSiteDomains: api.listSiteDomains,
  addSiteDomain: api.addSiteDomain,
  verifySiteDomain: api.verifySiteDomain,
  getMicrositeConfig: api.getMicrositeConfig,
  updateMicrositeConfig: api.updateMicrositeConfig,
};
