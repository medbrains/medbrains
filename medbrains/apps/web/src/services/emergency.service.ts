import { api } from "@medbrains/api";

export type CreateErVisitInput = Parameters<typeof api.createErVisit>[0];
export type AdmitFromErInput = Parameters<typeof api.admitFromEr>[1];
export type CreateCodeActivationInput = Parameters<typeof api.createCodeActivation>[0];
export type CreateMlcCaseInput = Parameters<typeof api.createMlcCase>[0];
export type CreateMlcDocumentInput = Parameters<typeof api.createMlcDocument>[1];
export type CreateMassCasualtyEventInput = Parameters<typeof api.createMassCasualtyEvent>[0];

export const emergencyService = {
  listErVisits: () => api.listErVisits(),
  createErVisit: (data: CreateErVisitInput) => api.createErVisit(data),
  admitFromEr: (visitId: string, data: AdmitFromErInput) => api.admitFromEr(visitId, data),
  listCodeActivations: () => api.listCodeActivations(),
  createCodeActivation: (data: CreateCodeActivationInput) => api.createCodeActivation(data),
  deactivateCode: (id: string) => api.deactivateCode(id, {}),
  listMlcCases: () => api.listMlcCases(),
  createMlcCase: (data: CreateMlcCaseInput) => api.createMlcCase(data),
  listMlcDocuments: (mlcId: string) => api.listMlcDocuments(mlcId),
  createMlcDocument: (mlcId: string, data: CreateMlcDocumentInput) =>
    api.createMlcDocument(mlcId, data),
  listMassCasualtyEvents: () => api.listMassCasualtyEvents(),
  createMassCasualtyEvent: (data: CreateMassCasualtyEventInput) =>
    api.createMassCasualtyEvent(data),
};
