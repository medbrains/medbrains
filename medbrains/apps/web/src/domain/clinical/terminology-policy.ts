import type {
  DiagnosisCodingMode,
  DiagnosisCodingSystem,
  TerminologySystem,
} from "@medbrains/types";

/** The ICD revisions a hospital's switch lets a doctor code in, primary first. */
export type IcdSystem = "icd11" | "icd10";

export function codingSystems(mode: DiagnosisCodingMode): IcdSystem[] {
  switch (mode) {
    case "icd11":
      return ["icd11"];
    case "icd10":
      return ["icd10"];
    case "both":
      return ["icd11", "icd10"];
  }
}

export function codingModeLabel(mode: DiagnosisCodingMode) {
  switch (mode) {
    case "icd11":
      return "ICD-11";
    case "icd10":
      return "ICD-10";
    case "both":
      return "ICD-11 and ICD-10";
  }
}

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
    case "icd10":
      return "Hospital ICD-10 catalogue";
    case "snomed":
      return "SNOMED CT";
  }
}

export function terminologySearchPlaceholder(system: TerminologySystem) {
  switch (system) {
    case "icd11":
      return "Search ICD-11 diagnosis...";
    case "icd10":
      return "Search ICD-10 diagnosis...";
    case "snomed":
      return "Search SNOMED CT concept...";
  }
}
