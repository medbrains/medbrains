import type { DiagnosisCodingSystem, TerminologySystem } from "@medbrains/types";

export interface DiagnosisTerminologyPolicy {
  scope: "tenant";
  primarySystem: TerminologySystem;
  secondarySystems: TerminologySystem[];
}

export const DIAGNOSIS_TERMINOLOGY_POLICY: DiagnosisTerminologyPolicy = {
  scope: "tenant",
  primarySystem: "icd11",
  secondarySystems: [],
};

export function terminologySystemLabel(system: DiagnosisCodingSystem | TerminologySystem) {
  switch (system) {
    case "icd10":
      return "ICD-10";
    case "icd11":
      return "ICD-11";
    case "snomed":
      return "SNOMED CT";
  }
}

export function terminologySourceLabel(system: TerminologySystem) {
  switch (system) {
    case "icd11":
      return "WHO ICD-11";
    case "snomed":
      return "SNOMED CT";
  }
}

export function terminologySearchPlaceholder(system: TerminologySystem) {
  switch (system) {
    case "icd11":
      return "Search ICD-11 diagnosis...";
    case "snomed":
      return "Search SNOMED CT concept...";
  }
}
