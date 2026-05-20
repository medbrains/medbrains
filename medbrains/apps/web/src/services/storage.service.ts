import { api } from "@medbrains/api";

export type StoragePolicy = Awaited<ReturnType<typeof api.listStoragePolicies>>[number];
export type StorageTransition = Awaited<ReturnType<typeof api.listStorageTransitions>>[number];
export type UpdateStoragePolicyInput = Parameters<typeof api.updateStoragePolicy>[1];
export type ListStorageTransitionsInput = Parameters<typeof api.listStorageTransitions>[0];

export const storageService = {
  triggerStorageSweep: () => api.triggerStorageSweep(),
  listStoragePolicies: () => api.listStoragePolicies(),
  updateStoragePolicy: (category: string, data: UpdateStoragePolicyInput) =>
    api.updateStoragePolicy(category, data),
  getStorageUsage: () => api.getStorageUsage(),
  listStorageTransitions: (params?: ListStorageTransitionsInput) =>
    api.listStorageTransitions(params),
};
