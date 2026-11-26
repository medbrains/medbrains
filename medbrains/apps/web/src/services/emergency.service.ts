import { emergencyApi } from "@medbrains/api/modules/emergency";
import { printDataApi } from "@medbrains/api/modules/print-data";

export type CreateErVisitInput = Parameters<typeof emergencyApi.createErVisit>[0];
export type AdmitFromErInput = Parameters<typeof emergencyApi.admitFromEr>[1];
export type CreateCodeActivationInput = Parameters<typeof emergencyApi.createCodeActivation>[0];
export type DeactivateCodeInput = Parameters<typeof emergencyApi.deactivateCode>[1];
export type CreateResuscitationLogInput = Parameters<typeof emergencyApi.createResuscitationLog>[1];
export type CreateMlcCaseInput = Parameters<typeof emergencyApi.createMlcCase>[0];
export type UpdateMlcCaseInput = Parameters<typeof emergencyApi.updateMlcCase>[1];
export type CreateMlcDocumentInput = Parameters<typeof emergencyApi.createMlcDocument>[1];
export type CreatePoliceIntimationInput = Parameters<typeof emergencyApi.createPoliceIntimation>[1];
export type ConfirmPoliceReceiptInput = Parameters<typeof emergencyApi.confirmPoliceReceipt>[1];
export type GetMlcRegisterPrintDataParams = Parameters<
  typeof printDataApi.getMlcRegisterPrintData
>[1];
export type GetMlcDocumentationPrintDataParams = Parameters<
  typeof printDataApi.getMlcDocumentationPrintData
>[1];
export type GetMlcPoliceIntimationPrintDataParams = Parameters<
  typeof printDataApi.getMlcPoliceIntimationPrintData
>[1];
export type CreateMassCasualtyEventInput = Parameters<
  typeof emergencyApi.createMassCasualtyEvent
>[0];
export type UpdateMassCasualtyEventInput = Parameters<
  typeof emergencyApi.updateMassCasualtyEvent
>[1];

export const emergencyService = {
  listErVisits: (...args: Parameters<typeof emergencyApi.listErVisits>) =>
    emergencyApi.listErVisits(...args),
  getErVisit: (id: string) => emergencyApi.getErVisit(id),
  createErVisit: (data: CreateErVisitInput) => emergencyApi.createErVisit(data),
  decideSuspectedMlc: (...args: Parameters<typeof emergencyApi.decideSuspectedMlc>) =>
    emergencyApi.decideSuspectedMlc(...args),
  admitFromEr: (visitId: string, data: AdmitFromErInput) => emergencyApi.admitFromEr(visitId, data),
  getErDischargeSummary: (visitId: string) => emergencyApi.getErDischargeSummary(visitId),
  createErDischargeSummary: (...args: Parameters<typeof emergencyApi.createErDischargeSummary>) =>
    emergencyApi.createErDischargeSummary(...args),
  updateErDischargeSummary: (...args: Parameters<typeof emergencyApi.updateErDischargeSummary>) =>
    emergencyApi.updateErDischargeSummary(...args),
  finalizeErDischargeSummary: (visitId: string) => emergencyApi.finalizeErDischargeSummary(visitId),
  listErBays: () => emergencyApi.listErBays(),
  createErBay: (...args: Parameters<typeof emergencyApi.createErBay>) =>
    emergencyApi.createErBay(...args),
  updateErBay: (...args: Parameters<typeof emergencyApi.updateErBay>) =>
    emergencyApi.updateErBay(...args),
  listTriageAssessments: (visitId: string) => emergencyApi.listTriageAssessments(visitId),
  createTriageAssessment: (...args: Parameters<typeof emergencyApi.createTriageAssessment>) =>
    emergencyApi.createTriageAssessment(...args),
  listErObservationNotes: (visitId: string) => emergencyApi.listErObservationNotes(visitId),
  createErObservationNote: (...args: Parameters<typeof emergencyApi.createErObservationNote>) =>
    emergencyApi.createErObservationNote(...args),
  listResuscitationLogs: (visitId: string) => emergencyApi.listResuscitationLogs(visitId),
  createResuscitationLog: (visitId: string, data: CreateResuscitationLogInput) =>
    emergencyApi.createResuscitationLog(visitId, data),
  listCodeActivations: () => emergencyApi.listCodeActivations(),
  createCodeActivation: (data: CreateCodeActivationInput) =>
    emergencyApi.createCodeActivation(data),
  deactivateCode: (id: string, data: DeactivateCodeInput) => emergencyApi.deactivateCode(id, data),
  listMlcCases: () => emergencyApi.listMlcCases(),
  createMlcCase: (data: CreateMlcCaseInput) => emergencyApi.createMlcCase(data),
  updateMlcCase: (id: string, data: UpdateMlcCaseInput) => emergencyApi.updateMlcCase(id, data),
  listMlcDocuments: (mlcId: string) => emergencyApi.listMlcDocuments(mlcId),
  listMlcInjuries: (mlcId: string) => emergencyApi.listMlcInjuries(mlcId),
  createMlcInjury: (...args: Parameters<typeof emergencyApi.createMlcInjury>) =>
    emergencyApi.createMlcInjury(...args),
  createMlcDocument: (mlcId: string, data: CreateMlcDocumentInput) =>
    emergencyApi.createMlcDocument(mlcId, data),
  listPoliceIntimations: (mlcId: string) => emergencyApi.listPoliceIntimations(mlcId),
  createPoliceIntimation: (mlcId: string, data: CreatePoliceIntimationInput) =>
    emergencyApi.createPoliceIntimation(mlcId, data),
  confirmPoliceReceipt: (id: string, data: ConfirmPoliceReceiptInput) =>
    emergencyApi.confirmPoliceReceipt(id, data),
  getMlcRegisterPrintData: (caseId: string, params?: GetMlcRegisterPrintDataParams) =>
    printDataApi.getMlcRegisterPrintData(caseId, params),
  getMlcDocumentationPrintData: (caseId: string, params?: GetMlcDocumentationPrintDataParams) =>
    printDataApi.getMlcDocumentationPrintData(caseId, params),
  getMlcPoliceIntimationPrintData: (
    intimationId: string,
    params?: GetMlcPoliceIntimationPrintDataParams,
  ) => printDataApi.getMlcPoliceIntimationPrintData(intimationId, params),
  listMassCasualtyEvents: () => emergencyApi.listMassCasualtyEvents(),
  createMassCasualtyEvent: (data: CreateMassCasualtyEventInput) =>
    emergencyApi.createMassCasualtyEvent(data),
  updateMassCasualtyEvent: (id: string, data: UpdateMassCasualtyEventInput) =>
    emergencyApi.updateMassCasualtyEvent(id, data),
};
