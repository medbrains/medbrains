import { pharmacyApi } from "@medbrains/api/modules/pharmacy";

export type CreatePharmacyCatalogInput = Parameters<typeof pharmacyApi.createPharmacyCatalog>[0];

export const pharmacyCatalogService = {
  listPharmacyCatalog: () => pharmacyApi.listPharmacyCatalog(),
  createPharmacyCatalog: (data: CreatePharmacyCatalogInput) =>
    pharmacyApi.createPharmacyCatalog(data),
};
