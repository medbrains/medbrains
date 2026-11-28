import { occHealthApi } from "@medbrains/api/modules/occ-health";

export const occupationalHealthService = {
  listOccScreenings: (...args: Parameters<typeof occHealthApi.listOccScreenings>) =>
    occHealthApi.listOccScreenings(...args),
  listDueScreenings: (...args: Parameters<typeof occHealthApi.listDueScreenings>) =>
    occHealthApi.listDueScreenings(...args),
  createOccScreening: (...args: Parameters<typeof occHealthApi.createOccScreening>) =>
    occHealthApi.createOccScreening(...args),
  updateOccScreening: (...args: Parameters<typeof occHealthApi.updateOccScreening>) =>
    occHealthApi.updateOccScreening(...args),
  listDrugScreens: (...args: Parameters<typeof occHealthApi.listDrugScreens>) =>
    occHealthApi.listDrugScreens(...args),
  createDrugScreen: (...args: Parameters<typeof occHealthApi.createDrugScreen>) =>
    occHealthApi.createDrugScreen(...args),
  updateDrugScreen: (...args: Parameters<typeof occHealthApi.updateDrugScreen>) =>
    occHealthApi.updateDrugScreen(...args),
  listVaccinations: (...args: Parameters<typeof occHealthApi.listVaccinations>) =>
    occHealthApi.listVaccinations(...args),
  vaccinationCompliance: (...args: Parameters<typeof occHealthApi.vaccinationCompliance>) =>
    occHealthApi.vaccinationCompliance(...args),
  createVaccination: (...args: Parameters<typeof occHealthApi.createVaccination>) =>
    occHealthApi.createVaccination(...args),
  listInjuries: (...args: Parameters<typeof occHealthApi.listInjuries>) =>
    occHealthApi.listInjuries(...args),
  createInjury: (...args: Parameters<typeof occHealthApi.createInjury>) =>
    occHealthApi.createInjury(...args),
  listExposures: (...args: Parameters<typeof occHealthApi.listExposures>) =>
    occHealthApi.listExposures(...args),
  createExposure: (...args: Parameters<typeof occHealthApi.createExposure>) =>
    occHealthApi.createExposure(...args),
  updateInjury: (...args: Parameters<typeof occHealthApi.updateInjury>) =>
    occHealthApi.updateInjury(...args),
  listOccHealthHazards: (...args: Parameters<typeof occHealthApi.listOccHealthHazards>) =>
    occHealthApi.listOccHealthHazards(...args),
  createOccHealthHazard: (...args: Parameters<typeof occHealthApi.createOccHealthHazard>) =>
    occHealthApi.createOccHealthHazard(...args),
  occHealthAnalytics: (...args: Parameters<typeof occHealthApi.occHealthAnalytics>) =>
    occHealthApi.occHealthAnalytics(...args),
  returnToWorkClearance: (...args: Parameters<typeof occHealthApi.returnToWorkClearance>) =>
    occHealthApi.returnToWorkClearance(...args),
};
