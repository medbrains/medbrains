import { api } from "@medbrains/api";

export const sepsisBundleService = {
  createSepsisBundle: (data: Parameters<typeof api.createSepsisBundle>[0]) =>
    api.createSepsisBundle(data),
  updateSepsisBundle: (id: string, data: Parameters<typeof api.updateSepsisBundle>[1]) =>
    api.updateSepsisBundle(id, data),
  listSepsisBundles: (patientId: string) => api.listSepsisBundles(patientId),
};
