import { ipdApi } from "@medbrains/api/modules/ipd";
import { opdApi } from "@medbrains/api/modules/opd";

export type CreateEncounterInput = Parameters<typeof opdApi.createEncounter>[0];
export type IpdDamaInput = Parameters<typeof ipdApi.recordIpdDama>[1];
export type IpdMortalityInput = Parameters<typeof ipdApi.createIpdMortalityReview>[0];

export const clinicalActionsService = {
  createEncounter: (data: CreateEncounterInput) => opdApi.createEncounter(data),
  recordIpdDama: (admissionId: string, body: IpdDamaInput) =>
    ipdApi.recordIpdDama(admissionId, body),
  createIpdMortalityReview: (body: IpdMortalityInput) => ipdApi.createIpdMortalityReview(body),
};
