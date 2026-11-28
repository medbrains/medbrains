import { clinicalApi } from "@medbrains/api/modules/clinical";

export const medReconciliationService = {
  createMedReconciliation: (data: Parameters<typeof clinicalApi.createMedReconciliation>[0]) =>
    clinicalApi.createMedReconciliation(data),
  decideMedItem: (id: string, data: Parameters<typeof clinicalApi.decideMedItem>[1]) =>
    clinicalApi.decideMedItem(id, data),
  completeMedReconciliation: (id: string) => clinicalApi.completeMedReconciliation(id),
  listMedReconciliations: (patientId: string) => clinicalApi.listMedReconciliations(patientId),
};
