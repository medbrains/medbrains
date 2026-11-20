import { clinicalApi } from "@medbrains/api/modules/clinical";

export const sepsisBundleService = {
  createSepsisBundle: (data: Parameters<typeof clinicalApi.createSepsisBundle>[0]) =>
    clinicalApi.createSepsisBundle(data),
  updateSepsisBundle: (id: string, data: Parameters<typeof clinicalApi.updateSepsisBundle>[1]) =>
    clinicalApi.updateSepsisBundle(id, data),
  listSepsisBundles: (patientId: string) => clinicalApi.listSepsisBundles(patientId),
};
