import { api } from "@medbrains/api";
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
  listCssdInstruments: api.listCssdInstruments,
  createCssdInstrument: (data: CreateCssdInstrumentRequest) => api.createCssdInstrument(data),
  listCssdSets: api.listCssdSets,
  createCssdSet: (data: CreateCssdSetRequest) => api.createCssdSet(data),
  listCssdLoads: api.listCssdLoads,
  createCssdLoad: (data: CreateCssdLoadRequest) => api.createCssdLoad(data),
  updateCssdLoadStatus: (id: string, status: LoadStatus) =>
    api.updateCssdLoadStatus(id, { status }),
  listCssdLoadItems: (loadId: string) => api.listCssdLoadItems(loadId),
  addCssdLoadItem: (...args: Parameters<typeof api.addCssdLoadItem>) =>
    api.addCssdLoadItem(...args),
  getCssdSetItems: (setId: string) => api.getCssdSetItems(setId),
  listCssdIndicators: api.listCssdIndicators,
  recordCssdIndicator: (loadId: string, data: RecordCssdIndicatorRequest) =>
    api.recordCssdIndicator(loadId, data),
  listCssdIssuances: api.listCssdIssuances,
  createCssdIssuance: (data: CreateCssdIssuanceRequest) => api.createCssdIssuance(data),
  returnCssdIssuance: api.returnCssdIssuance,
  recallCssdIssuance: api.recallCssdIssuance,
  listCssdSterilizers: api.listCssdSterilizers,
  createCssdSterilizer: (data: CreateCssdSterilizerRequest) => api.createCssdSterilizer(data),
  listCssdMaintenanceLogs: api.listCssdMaintenanceLogs,
  createCssdMaintenanceLog: (sterilizerId: string, data: CreateCssdMaintenanceRequest) =>
    api.createCssdMaintenanceLog(sterilizerId, data),
};
