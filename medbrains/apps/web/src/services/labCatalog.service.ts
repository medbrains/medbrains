import { labApi } from "@medbrains/api/modules/lab";

export type CreateLabCatalogInput = Parameters<typeof labApi.createLabCatalogEntry>[0];

export const labCatalogService = {
  listLabCatalog: () => labApi.listLabCatalog(),
  createLabCatalogEntry: (data: CreateLabCatalogInput) => labApi.createLabCatalogEntry(data),
};
