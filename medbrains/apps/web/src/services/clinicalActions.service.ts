import { api } from "@medbrains/api";

export type CreateEncounterInput = Parameters<typeof api.createEncounter>[0];
export type IpdDamaInput = Parameters<typeof api.recordIpdDama>[1];
export type IpdMortalityInput = Parameters<typeof api.createIpdMortalityReview>[0];

export const clinicalActionsService = {
  createEncounter: (data: CreateEncounterInput) => api.createEncounter(data),
  recordIpdDama: (admissionId: string, body: IpdDamaInput) => api.recordIpdDama(admissionId, body),
  createIpdMortalityReview: (body: IpdMortalityInput) => api.createIpdMortalityReview(body),
};
