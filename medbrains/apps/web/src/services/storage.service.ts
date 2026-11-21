import { adminApi } from "@medbrains/api/modules/admin";

export type StoragePolicy = Awaited<ReturnType<typeof adminApi.listStoragePolicies>>[number];
export type StorageTransition = Awaited<ReturnType<typeof adminApi.listStorageTransitions>>[number];
export type UpdateStoragePolicyInput = Parameters<typeof adminApi.updateStoragePolicy>[1];
export type ListStorageTransitionsInput = Parameters<typeof adminApi.listStorageTransitions>[0];

export const storageService = {
  triggerStorageSweep: () => adminApi.triggerStorageSweep(),
  listStoragePolicies: () => adminApi.listStoragePolicies(),
  updateStoragePolicy: (category: string, data: UpdateStoragePolicyInput) =>
    adminApi.updateStoragePolicy(category, data),
  getStorageUsage: () => adminApi.getStorageUsage(),
  listStorageTransitions: (params?: ListStorageTransitionsInput) =>
    adminApi.listStorageTransitions(params),
};
