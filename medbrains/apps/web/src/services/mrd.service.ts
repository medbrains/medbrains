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
};
