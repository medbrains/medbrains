import { api } from "@medbrains/api";

export type CreateErVisitInput = Parameters<typeof api.createErVisit>[0];
export type AdmitFromErInput = Parameters<typeof api.admitFromEr>[1];
export type CreateCodeActivationInput = Parameters<typeof api.createCodeActivation>[0];
export type DeactivateCodeInput = Parameters<typeof api.deactivateCode>[1];
export type CreateResuscitationLogInput = Parameters<typeof api.createResuscitationLog>[1];
export type CreateMlcCaseInput = Parameters<typeof api.createMlcCase>[0];
export type UpdateMlcCaseInput = Parameters<typeof api.updateMlcCase>[1];
export type CreateMlcDocumentInput = Parameters<typeof api.createMlcDocument>[1];
export type CreatePoliceIntimationInput = Parameters<typeof api.createPoliceIntimation>[1];
export type ConfirmPoliceReceiptInput = Parameters<typeof api.confirmPoliceReceipt>[1];
export type GetMlcRegisterPrintDataParams = Parameters<typeof api.getMlcRegisterPrintData>[1];
export type GetMlcDocumentationPrintDataParams = Parameters<
  typeof api.getMlcDocumentationPrintData
>[1];
export type GetMlcPoliceIntimationPrintDataParams = Parameters<
  typeof api.getMlcPoliceIntimationPrintData
>[1];
export type CreateMassCasualtyEventInput = Parameters<typeof api.createMassCasualtyEvent>[0];
export type UpdateMassCasualtyEventInput = Parameters<typeof api.updateMassCasualtyEvent>[1];

export const emergencyService = {
  listErVisits: (...args: Parameters<typeof api.listErVisits>) => api.listErVisits(...args),
  getErVisit: (id: string) => api.getErVisit(id),
  createErVisit: (data: CreateErVisitInput) => api.createErVisit(data),
  admitFromEr: (visitId: string, data: AdmitFromErInput) => api.admitFromEr(visitId, data),
  getErDischargeSummary: (visitId: string) => api.getErDischargeSummary(visitId),
  createErDischargeSummary: (...args: Parameters<typeof api.createErDischargeSummary>) =>
    api.createErDischargeSummary(...args),
  updateErDischargeSummary: (...args: Parameters<typeof api.updateErDischargeSummary>) =>
    api.updateErDischargeSummary(...args),
  finalizeErDischargeSummary: (visitId: string) => api.finalizeErDischargeSummary(visitId),
  listErBays: () => api.listErBays(),
  createErBay: (...args: Parameters<typeof api.createErBay>) => api.createErBay(...args),
  updateErBay: (...args: Parameters<typeof api.updateErBay>) => api.updateErBay(...args),
  listErObservationNotes: (visitId: string) => api.listErObservationNotes(visitId),
  createErObservationNote: (...args: Parameters<typeof api.createErObservationNote>) =>
    api.createErObservationNote(...args),
  listResuscitationLogs: (visitId: string) => api.listResuscitationLogs(visitId),
  createResuscitationLog: (visitId: string, data: CreateResuscitationLogInput) =>
    api.createResuscitationLog(visitId, data),
  listCodeActivations: () => api.listCodeActivations(),
  createCodeActivation: (data: CreateCodeActivationInput) => api.createCodeActivation(data),
  deactivateCode: (id: string, data: DeactivateCodeInput) => api.deactivateCode(id, data),
  listMlcCases: () => api.listMlcCases(),
  createMlcCase: (data: CreateMlcCaseInput) => api.createMlcCase(data),
  updateMlcCase: (id: string, data: UpdateMlcCaseInput) => api.updateMlcCase(id, data),
  listMlcDocuments: (mlcId: string) => api.listMlcDocuments(mlcId),
  createMlcDocument: (mlcId: string, data: CreateMlcDocumentInput) =>
    api.createMlcDocument(mlcId, data),
  listPoliceIntimations: (mlcId: string) => api.listPoliceIntimations(mlcId),
  createPoliceIntimation: (mlcId: string, data: CreatePoliceIntimationInput) =>
    api.createPoliceIntimation(mlcId, data),
  confirmPoliceReceipt: (id: string, data: ConfirmPoliceReceiptInput) =>
    api.confirmPoliceReceipt(id, data),
  getMlcRegisterPrintData: (caseId: string, params?: GetMlcRegisterPrintDataParams) =>
    api.getMlcRegisterPrintData(caseId, params),
  getMlcDocumentationPrintData: (caseId: string, params?: GetMlcDocumentationPrintDataParams) =>
    api.getMlcDocumentationPrintData(caseId, params),
  getMlcPoliceIntimationPrintData: (
    intimationId: string,
    params?: GetMlcPoliceIntimationPrintDataParams,
  ) => api.getMlcPoliceIntimationPrintData(intimationId, params),
  listMassCasualtyEvents: () => api.listMassCasualtyEvents(),
  createMassCasualtyEvent: (data: CreateMassCasualtyEventInput) =>
    api.createMassCasualtyEvent(data),
  updateMassCasualtyEvent: (id: string, data: UpdateMassCasualtyEventInput) =>
    api.updateMassCasualtyEvent(id, data),
};
