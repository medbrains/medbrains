import { api } from "@medbrains/api";

export const clinicalTrialsService = {
  listClinicalTrials: api.listClinicalTrials,
  getClinicalTrial: api.getClinicalTrial,
  createClinicalTrial: api.createClinicalTrial,
  updateClinicalTrial: api.updateClinicalTrial,
};
