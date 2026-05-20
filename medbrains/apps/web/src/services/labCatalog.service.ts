import { api } from "@medbrains/api";

export type CreateLabCatalogInput = Parameters<typeof api.createLabCatalogEntry>[0];

export const labCatalogService = {
  listLabCatalog: () => api.listLabCatalog(),
  createLabCatalogEntry: (data: CreateLabCatalogInput) => api.createLabCatalogEntry(data),
};
