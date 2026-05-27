import { api } from "@medbrains/api";

export const mrdService = {
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
};
