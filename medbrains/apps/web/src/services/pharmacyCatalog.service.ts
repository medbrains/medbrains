import { api } from "@medbrains/api";

export type CreatePharmacyCatalogInput = Parameters<typeof api.createPharmacyCatalog>[0];

export const pharmacyCatalogService = {
  listPharmacyCatalog: () => api.listPharmacyCatalog(),
  createPharmacyCatalog: (data: CreatePharmacyCatalogInput) => api.createPharmacyCatalog(data),
};
