import { api } from "@medbrains/api";

export const medReconciliationService = {
  createMedReconciliation: (data: Parameters<typeof api.createMedReconciliation>[0]) =>
    api.createMedReconciliation(data),
  decideMedItem: (id: string, data: Parameters<typeof api.decideMedItem>[1]) =>
    api.decideMedItem(id, data),
  completeMedReconciliation: (id: string) => api.completeMedReconciliation(id),
  listMedReconciliations: (patientId: string) => api.listMedReconciliations(patientId),
};
