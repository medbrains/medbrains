import { api } from "@medbrains/api";

/** The hospital's diagnosis coding switch and its licensed ICD-10 catalogue. */
export const diagnosisCodingService = {
  get: api.getDiagnosisCoding,
  set: api.setDiagnosisCoding,
  listIcd10Releases: api.listIcd10Releases,
  importIcd10Release: api.importIcd10Release,
};

export const DIAGNOSIS_CODING_KEY = ["diagnosis-coding"] as const;

/** Shown in the picker when the hospital codes in ICD-10 but has loaded no
 * catalogue — never an empty list that reads as "no match". */
export const ICD10_NOT_LOADED = "ICD-10 catalogue not loaded — ask your administrator";
