import { api } from "@medbrains/api";

export type ListHomeCollectionsInput = Parameters<typeof api.listHomeCollections>[0];
export type UpdateHomeCollectionStatusInput = Parameters<typeof api.updateHomeCollectionStatus>[1];

export const phlebotomyService = {
  listHomeCollections: (params: ListHomeCollectionsInput) => api.listHomeCollections(params),
  updateHomeCollectionStatus: (orderId: string, data: UpdateHomeCollectionStatusInput) =>
    api.updateHomeCollectionStatus(orderId, data),
};
