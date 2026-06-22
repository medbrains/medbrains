import { api } from "@medbrains/api";

export const mrdService = {
  presignUpload: (...args: Parameters<typeof api.presignUpload>) => api.presignUpload(...args),
  listIngestionBatches: (...args: Parameters<typeof api.listIngestionBatches>) =>
    api.listIngestionBatches(...args),
  createIngestionBatch: (...args: Parameters<typeof api.createIngestionBatch>) =>
    api.createIngestionBatch(...args),
  listIngestionItems: (...args: Parameters<typeof api.listIngestionItems>) =>
    api.listIngestionItems(...args),
  addIngestionItem: (...args: Parameters<typeof api.addIngestionItem>) =>
    api.addIngestionItem(...args),
  linkIngestionItem: (...args: Parameters<typeof api.linkIngestionItem>) =>
    api.linkIngestionItem(...args),
  fileIngestionItem: (...args: Parameters<typeof api.fileIngestionItem>) =>
    api.fileIngestionItem(...args),
  listRoiRequests: (...args: Parameters<typeof api.listRoiRequests>) =>
    api.listRoiRequests(...args),
  createRoiRequest: (...args: Parameters<typeof api.createRoiRequest>) =>
    api.createRoiRequest(...args),
  reviewRoiRequest: (...args: Parameters<typeof api.reviewRoiRequest>) =>
    api.reviewRoiRequest(...args),
  recordRoiAccess: (...args: Parameters<typeof api.recordRoiAccess>) =>
    api.recordRoiAccess(...args),
  listRoiAccessLog: (...args: Parameters<typeof api.listRoiAccessLog>) =>
    api.listRoiAccessLog(...args),
  listMrdRecords: (...args: Parameters<typeof api.listMrdRecords>) => api.listMrdRecords(...args),
  createMrdRecord: (...args: Parameters<typeof api.createMrdRecord>) =>
    api.createMrdRecord(...args),
  issueMrdRecord: (...args: Parameters<typeof api.issueMrdRecord>) => api.issueMrdRecord(...args),
  listMrdMovements: (...args: Parameters<typeof api.listMrdMovements>) =>
    api.listMrdMovements(...args),
  returnMrdRecord: (...args: Parameters<typeof api.returnMrdRecord>) =>
    api.returnMrdRecord(...args),
  listMrdBirths: (...args: Parameters<typeof api.listMrdBirths>) => api.listMrdBirths(...args),
  createMrdBirth: (...args: Parameters<typeof api.createMrdBirth>) => api.createMrdBirth(...args),
  listMrdDeaths: (...args: Parameters<typeof api.listMrdDeaths>) => api.listMrdDeaths(...args),
  createMrdDeath: (...args: Parameters<typeof api.createMrdDeath>) => api.createMrdDeath(...args),
  getMrdMorbidityMortality: (...args: Parameters<typeof api.getMrdMorbidityMortality>) =>
    api.getMrdMorbidityMortality(...args),
  getMrdAdmissionDischarge: (...args: Parameters<typeof api.getMrdAdmissionDischarge>) =>
    api.getMrdAdmissionDischarge(...args),
  listMrdRetentionPolicies: (...args: Parameters<typeof api.listMrdRetentionPolicies>) =>
    api.listMrdRetentionPolicies(...args),
  createMrdRetentionPolicy: (...args: Parameters<typeof api.createMrdRetentionPolicy>) =>
    api.createMrdRetentionPolicy(...args),
  listMrdStorageLocations: (...args: Parameters<typeof api.listMrdStorageLocations>) =>
    api.listMrdStorageLocations(...args),
  createMrdStorageLocation: (...args: Parameters<typeof api.createMrdStorageLocation>) =>
    api.createMrdStorageLocation(...args),
  updateMrdStorageLocation: (...args: Parameters<typeof api.updateMrdStorageLocation>) =>
    api.updateMrdStorageLocation(...args),
  listMrdCaseSheetPackets: (...args: Parameters<typeof api.listMrdCaseSheetPackets>) =>
    api.listMrdCaseSheetPackets(...args),
  getMrdCaseSheetPacket: (...args: Parameters<typeof api.getMrdCaseSheetPacket>) =>
    api.getMrdCaseSheetPacket(...args),
  listMrdCaseSheetPages: (...args: Parameters<typeof api.listMrdCaseSheetPages>) =>
    api.listMrdCaseSheetPages(...args),
  updateMrdCaseSheetPageStatus: (...args: Parameters<typeof api.updateMrdCaseSheetPageStatus>) =>
    api.updateMrdCaseSheetPageStatus(...args),
  getMrdCaseSheetCompleteness: (...args: Parameters<typeof api.getMrdCaseSheetCompleteness>) =>
    api.getMrdCaseSheetCompleteness(...args),
  generateOpdCaseSheetPacket: (...args: Parameters<typeof api.generateOpdCaseSheetPacket>) =>
    api.generateOpdCaseSheetPacket(...args),
  generateIpdCaseSheetPacket: (...args: Parameters<typeof api.generateIpdCaseSheetPacket>) =>
    api.generateIpdCaseSheetPacket(...args),
  printMrdCaseSheetPacket: (...args: Parameters<typeof api.printMrdCaseSheetPacket>) =>
    api.printMrdCaseSheetPacket(...args),
  fileMrdCaseSheetPacket: (...args: Parameters<typeof api.fileMrdCaseSheetPacket>) =>
    api.fileMrdCaseSheetPacket(...args),
  listMrdFormRecords: (...args: Parameters<typeof api.listMrdFormRecords>) =>
    api.listMrdFormRecords(...args),
  completeMrdFormRecord: (...args: Parameters<typeof api.completeMrdFormRecord>) =>
    api.completeMrdFormRecord(...args),
  verifyMrdFormRecord: (...args: Parameters<typeof api.verifyMrdFormRecord>) =>
    api.verifyMrdFormRecord(...args),
  attachMrdFormDocument: (...args: Parameters<typeof api.attachMrdFormDocument>) =>
    api.attachMrdFormDocument(...args),
};
