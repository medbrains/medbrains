import { documentIngestionApi } from "@medbrains/api/modules/document-ingestion";
import { mrdApi } from "@medbrains/api/modules/mrd";
import { roiRequestsApi } from "@medbrains/api/modules/roi-requests";
import { uploadApi } from "@medbrains/api/modules/upload";

export const mrdService = {
  presignUpload: (...args: Parameters<typeof uploadApi.presignUpload>) =>
    uploadApi.presignUpload(...args),
  listIngestionBatches: (...args: Parameters<typeof documentIngestionApi.listIngestionBatches>) =>
    documentIngestionApi.listIngestionBatches(...args),
  createIngestionBatch: (...args: Parameters<typeof documentIngestionApi.createIngestionBatch>) =>
    documentIngestionApi.createIngestionBatch(...args),
  listIngestionItems: (...args: Parameters<typeof documentIngestionApi.listIngestionItems>) =>
    documentIngestionApi.listIngestionItems(...args),
  addIngestionItem: (...args: Parameters<typeof documentIngestionApi.addIngestionItem>) =>
    documentIngestionApi.addIngestionItem(...args),
  linkIngestionItem: (...args: Parameters<typeof documentIngestionApi.linkIngestionItem>) =>
    documentIngestionApi.linkIngestionItem(...args),
  fileIngestionItem: (...args: Parameters<typeof documentIngestionApi.fileIngestionItem>) =>
    documentIngestionApi.fileIngestionItem(...args),
  ocrIngestionItem: (...args: Parameters<typeof documentIngestionApi.ocrIngestionItem>) =>
    documentIngestionApi.ocrIngestionItem(...args),
  searchIngested: (...args: Parameters<typeof documentIngestionApi.searchIngested>) =>
    documentIngestionApi.searchIngested(...args),
  listRoiRequests: (...args: Parameters<typeof roiRequestsApi.listRoiRequests>) =>
    roiRequestsApi.listRoiRequests(...args),
  createRoiRequest: (...args: Parameters<typeof roiRequestsApi.createRoiRequest>) =>
    roiRequestsApi.createRoiRequest(...args),
  reviewRoiRequest: (...args: Parameters<typeof roiRequestsApi.reviewRoiRequest>) =>
    roiRequestsApi.reviewRoiRequest(...args),
  recordRoiAccess: (...args: Parameters<typeof roiRequestsApi.recordRoiAccess>) =>
    roiRequestsApi.recordRoiAccess(...args),
  listRoiAccessLog: (...args: Parameters<typeof roiRequestsApi.listRoiAccessLog>) =>
    roiRequestsApi.listRoiAccessLog(...args),
  listMrdRecords: (...args: Parameters<typeof mrdApi.listMrdRecords>) =>
    mrdApi.listMrdRecords(...args),
  createMrdRecord: (...args: Parameters<typeof mrdApi.createMrdRecord>) =>
    mrdApi.createMrdRecord(...args),
  issueMrdRecord: (...args: Parameters<typeof mrdApi.issueMrdRecord>) =>
    mrdApi.issueMrdRecord(...args),
  listMrdMovements: (...args: Parameters<typeof mrdApi.listMrdMovements>) =>
    mrdApi.listMrdMovements(...args),
  returnMrdRecord: (...args: Parameters<typeof mrdApi.returnMrdRecord>) =>
    mrdApi.returnMrdRecord(...args),
  listMrdFileRequests: (...args: Parameters<typeof mrdApi.listMrdFileRequests>) =>
    mrdApi.listMrdFileRequests(...args),
  scanMrdFileRequest: (...args: Parameters<typeof mrdApi.scanMrdFileRequest>) =>
    mrdApi.scanMrdFileRequest(...args),
  markMrdFileNotFound: (...args: Parameters<typeof mrdApi.markMrdFileNotFound>) =>
    mrdApi.markMrdFileNotFound(...args),
  returnMrdFileToShelf: (...args: Parameters<typeof mrdApi.returnMrdFileToShelf>) =>
    mrdApi.returnMrdFileToShelf(...args),
  buildMrdPullList: (...args: Parameters<typeof mrdApi.buildMrdPullList>) =>
    mrdApi.buildMrdPullList(...args),
  listMrdBackscanOrder: (...args: Parameters<typeof mrdApi.listMrdBackscanOrder>) =>
    mrdApi.listMrdBackscanOrder(...args),
  getMrdFileDeliveryTimes: (...args: Parameters<typeof mrdApi.getMrdFileDeliveryTimes>) =>
    mrdApi.getMrdFileDeliveryTimes(...args),
  getVisitFileStatus: (...args: Parameters<typeof mrdApi.getVisitFileStatus>) =>
    mrdApi.getVisitFileStatus(...args),
  requestVisitFile: (...args: Parameters<typeof mrdApi.requestVisitFile>) =>
    mrdApi.requestVisitFile(...args),
  getVisitDigitalSummary: (...args: Parameters<typeof mrdApi.getVisitDigitalSummary>) =>
    mrdApi.getVisitDigitalSummary(...args),
  listMrdBirths: (...args: Parameters<typeof mrdApi.listMrdBirths>) =>
    mrdApi.listMrdBirths(...args),
  createMrdBirth: (...args: Parameters<typeof mrdApi.createMrdBirth>) =>
    mrdApi.createMrdBirth(...args),
  listMrdDeaths: (...args: Parameters<typeof mrdApi.listMrdDeaths>) =>
    mrdApi.listMrdDeaths(...args),
  createMrdDeath: (...args: Parameters<typeof mrdApi.createMrdDeath>) =>
    mrdApi.createMrdDeath(...args),
  listCrsEvents: (status?: string) => mrdApi.listCrsEvents(status),
  getCrsForm: (id: string) => mrdApi.getCrsForm(id),
  recordCrsRegistration: (...args: Parameters<typeof mrdApi.recordCrsRegistration>) =>
    mrdApi.recordCrsRegistration(...args),
  getMrdMorbidityMortality: (...args: Parameters<typeof mrdApi.getMrdMorbidityMortality>) =>
    mrdApi.getMrdMorbidityMortality(...args),
  getMrdAdmissionDischarge: (...args: Parameters<typeof mrdApi.getMrdAdmissionDischarge>) =>
    mrdApi.getMrdAdmissionDischarge(...args),
  listMrdRetentionPolicies: (...args: Parameters<typeof mrdApi.listMrdRetentionPolicies>) =>
    mrdApi.listMrdRetentionPolicies(...args),
  createMrdRetentionPolicy: (...args: Parameters<typeof mrdApi.createMrdRetentionPolicy>) =>
    mrdApi.createMrdRetentionPolicy(...args),
  listMrdStorageLocations: (...args: Parameters<typeof mrdApi.listMrdStorageLocations>) =>
    mrdApi.listMrdStorageLocations(...args),
  createMrdStorageLocation: (...args: Parameters<typeof mrdApi.createMrdStorageLocation>) =>
    mrdApi.createMrdStorageLocation(...args),
  updateMrdStorageLocation: (...args: Parameters<typeof mrdApi.updateMrdStorageLocation>) =>
    mrdApi.updateMrdStorageLocation(...args),
  listMrdCaseSheetPackets: (...args: Parameters<typeof mrdApi.listMrdCaseSheetPackets>) =>
    mrdApi.listMrdCaseSheetPackets(...args),
  getMrdCaseSheetPacket: (...args: Parameters<typeof mrdApi.getMrdCaseSheetPacket>) =>
    mrdApi.getMrdCaseSheetPacket(...args),
  listMrdCaseSheetPages: (...args: Parameters<typeof mrdApi.listMrdCaseSheetPages>) =>
    mrdApi.listMrdCaseSheetPages(...args),
  updateMrdCaseSheetPageStatus: (...args: Parameters<typeof mrdApi.updateMrdCaseSheetPageStatus>) =>
    mrdApi.updateMrdCaseSheetPageStatus(...args),
  getMrdCaseSheetCompleteness: (...args: Parameters<typeof mrdApi.getMrdCaseSheetCompleteness>) =>
    mrdApi.getMrdCaseSheetCompleteness(...args),
  generateOpdCaseSheetPacket: (...args: Parameters<typeof mrdApi.generateOpdCaseSheetPacket>) =>
    mrdApi.generateOpdCaseSheetPacket(...args),
  generateIpdCaseSheetPacket: (...args: Parameters<typeof mrdApi.generateIpdCaseSheetPacket>) =>
    mrdApi.generateIpdCaseSheetPacket(...args),
  printMrdCaseSheetPacket: (...args: Parameters<typeof mrdApi.printMrdCaseSheetPacket>) =>
    mrdApi.printMrdCaseSheetPacket(...args),
  fileMrdCaseSheetPacket: (...args: Parameters<typeof mrdApi.fileMrdCaseSheetPacket>) =>
    mrdApi.fileMrdCaseSheetPacket(...args),
};
