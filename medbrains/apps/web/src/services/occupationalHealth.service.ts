import { api } from "@medbrains/api";

export const occupationalHealthService = {
  listOccScreenings: (...args: Parameters<typeof api.listOccScreenings>) =>
    api.listOccScreenings(...args),
  listDueScreenings: (...args: Parameters<typeof api.listDueScreenings>) =>
    api.listDueScreenings(...args),
  createOccScreening: (...args: Parameters<typeof api.createOccScreening>) =>
    api.createOccScreening(...args),
  updateOccScreening: (...args: Parameters<typeof api.updateOccScreening>) =>
    api.updateOccScreening(...args),
  listDrugScreens: (...args: Parameters<typeof api.listDrugScreens>) =>
    api.listDrugScreens(...args),
  createDrugScreen: (...args: Parameters<typeof api.createDrugScreen>) =>
    api.createDrugScreen(...args),
  updateDrugScreen: (...args: Parameters<typeof api.updateDrugScreen>) =>
    api.updateDrugScreen(...args),
  listVaccinations: (...args: Parameters<typeof api.listVaccinations>) =>
    api.listVaccinations(...args),
  vaccinationCompliance: (...args: Parameters<typeof api.vaccinationCompliance>) =>
    api.vaccinationCompliance(...args),
  createVaccination: (...args: Parameters<typeof api.createVaccination>) =>
    api.createVaccination(...args),
  listInjuries: (...args: Parameters<typeof api.listInjuries>) => api.listInjuries(...args),
  createInjury: (...args: Parameters<typeof api.createInjury>) => api.createInjury(...args),
  listExposures: (...args: Parameters<typeof api.listExposures>) => api.listExposures(...args),
  createExposure: (...args: Parameters<typeof api.createExposure>) => api.createExposure(...args),
  updateInjury: (...args: Parameters<typeof api.updateInjury>) => api.updateInjury(...args),
  listOccHealthHazards: (...args: Parameters<typeof api.listOccHealthHazards>) =>
    api.listOccHealthHazards(...args),
  createOccHealthHazard: (...args: Parameters<typeof api.createOccHealthHazard>) =>
    api.createOccHealthHazard(...args),
  occHealthAnalytics: (...args: Parameters<typeof api.occHealthAnalytics>) =>
    api.occHealthAnalytics(...args),
  returnToWorkClearance: (...args: Parameters<typeof api.returnToWorkClearance>) =>
    api.returnToWorkClearance(...args),
};
