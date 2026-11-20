import { cssdApi } from "@medbrains/api/modules/cssd";
import type {
  CreateCssdInstrumentRequest,
  CreateCssdIssuanceRequest,
  CreateCssdLoadRequest,
  CreateCssdMaintenanceRequest,
  CreateCssdSetRequest,
  CreateCssdSterilizerRequest,
  LoadStatus,
  RecordCssdIndicatorRequest,
} from "@medbrains/types";

export const cssdService = {
  listCssdInstruments: cssdApi.listCssdInstruments,
  createCssdInstrument: (data: CreateCssdInstrumentRequest) => cssdApi.createCssdInstrument(data),
  listCssdSets: cssdApi.listCssdSets,
  createCssdSet: (data: CreateCssdSetRequest) => cssdApi.createCssdSet(data),
  listCssdLoads: cssdApi.listCssdLoads,
  createCssdLoad: (data: CreateCssdLoadRequest) => cssdApi.createCssdLoad(data),
  updateCssdLoadStatus: (id: string, status: LoadStatus) =>
    cssdApi.updateCssdLoadStatus(id, { status }),
  listCssdLoadItems: (loadId: string) => cssdApi.listCssdLoadItems(loadId),
  listCssdLoadIssuances: (loadId: string) => cssdApi.listCssdLoadIssuances(loadId),
  recallCssdLoad: (loadId: string, reason: string) => cssdApi.recallCssdLoad(loadId, reason),
  addCssdLoadItem: (...args: Parameters<typeof cssdApi.addCssdLoadItem>) =>
    cssdApi.addCssdLoadItem(...args),
  getCssdSetItems: (setId: string) => cssdApi.getCssdSetItems(setId),
  listCssdIndicators: cssdApi.listCssdIndicators,
  recordCssdIndicator: (loadId: string, data: RecordCssdIndicatorRequest) =>
    cssdApi.recordCssdIndicator(loadId, data),
  listCssdIssuances: cssdApi.listCssdIssuances,
  createCssdIssuance: (data: CreateCssdIssuanceRequest) => cssdApi.createCssdIssuance(data),
  returnCssdIssuance: cssdApi.returnCssdIssuance,
  recallCssdIssuance: cssdApi.recallCssdIssuance,
  listCssdSterilizers: cssdApi.listCssdSterilizers,
  createCssdSterilizer: (data: CreateCssdSterilizerRequest) => cssdApi.createCssdSterilizer(data),
  listCssdMaintenanceLogs: cssdApi.listCssdMaintenanceLogs,
  createCssdMaintenanceLog: (sterilizerId: string, data: CreateCssdMaintenanceRequest) =>
    cssdApi.createCssdMaintenanceLog(sterilizerId, data),
};
