import { terminologyApi } from "@medbrains/api/modules/terminology";

/** The hospital's diagnosis coding switch and its licensed ICD-10 catalogue. */
export const diagnosisCodingService = {
  get: terminologyApi.getDiagnosisCoding,
  set: terminologyApi.setDiagnosisCoding,
  listIcd10Releases: terminologyApi.listIcd10Releases,
  importIcd10Release: terminologyApi.importIcd10Release,
};

export const DIAGNOSIS_CODING_KEY = ["diagnosis-coding"] as const;

/** Shown in the picker when the hospital codes in ICD-10 but has loaded no
 * catalogue — never an empty list that reads as "no match". */
export const ICD10_NOT_LOADED = "ICD-10 catalogue not loaded — ask your administrator";
